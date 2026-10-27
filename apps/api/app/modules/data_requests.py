"""Data requests from applications: authorize, retrieve only permitted resources, validate, normalize, audit.

Callers authenticate either with a workspace session (the vendor that owns the application, or the demo
administrator acting on behalf of a demo application) or with application client credentials
(X-Client-Id / X-Client-Secret headers).
"""

import time

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError, not_found
from ..middleware import RateLimiter
from ..models import Application, Organization, PatientLink, User
from .applications import authenticate_client
from .audit import record_event
from .auth import current_user
from .connectors import ConnectorError, FhirConnector
from .fhir import CLINICAL_RESOURCE_TYPES, PATIENT_PARAM, bundle_resources, patient_summary, summarize, validate_bundle, validate_resource, resource_date
from .policies import Purpose, evaluate

router = APIRouter(tags=["data requests"])
data_limiter = RateLimiter(limit=60, window_seconds=60)


class PatientRef(BaseModel):
    link_id: str | None = None
    organization_id: str | None = None
    patient_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9\-.]{1,64}$")

    @model_validator(mode="after")
    def _one(self):
        if bool(self.link_id) == bool(self.organization_id and self.patient_id):
            raise ValueError("Provide either link_id, or organization_id and patient_id")
        return self


class DataRequestIn(BaseModel):
    application_id: str | None = None
    patient: PatientRef
    resource_types: list[str] = Field(min_length=1, max_length=9)
    purpose: Purpose

    @field_validator("resource_types")
    @classmethod
    def _rt(cls, v: list[str]) -> list[str]:
        bad = [r for r in v if r not in CLINICAL_RESOURCE_TYPES]
        if bad:
            raise ValueError(f"Unsupported resource types: {', '.join(bad)}")
        return list(dict.fromkeys(v))


def resolve_application(request: Request, db: Session, application_id: str | None) -> tuple[Application, User | None]:
    cid, secret = request.headers.get("X-Client-Id"), request.headers.get("X-Client-Secret")
    if cid and secret:
        app = authenticate_client(db, cid, secret)
        if application_id and application_id != app.id:
            raise ApiError(403, "forbidden", "Client credentials do not belong to this application")
        return app, None
    user = current_user(request, db)
    if not application_id:
        raise ApiError(422, "validation_error", "application_id is required", [{"field": "application_id", "message": "Field required"}])
    app = db.get(Application, application_id)
    if not app:
        raise not_found("Application")
    if user.role == "vendor_dev" and app.owner_id == user.id:
        return app, user
    if user.role == "demo_admin":
        return app, user
    raise ApiError(403, "forbidden", "Only the application's owner can send requests on its behalf")


def _targets(db: Session, ref: PatientRef) -> tuple[list[tuple[Organization, str]], str, str | None]:
    if ref.link_id:
        lk = db.get(PatientLink, ref.link_id)
        if not lk:
            raise not_found("Patient link")
        if lk.status != "confirmed":
            raise ApiError(409, "link_not_confirmed", "This patient match has not been confirmed by an authorized reviewer")
        out = []
        for m in lk.members:
            org = db.get(Organization, m["organization_id"])
            if org:
                out.append((org, m["patient_id"]))
        return out, lk.consent_status, lk.id
    org = db.get(Organization, ref.organization_id)
    if not org:
        raise not_found("Organization")
    consent = "active"
    for lk in db.scalars(select(PatientLink).where(PatientLink.status == "confirmed")):
        if any(m["organization_id"] == org.id and m["patient_id"] == ref.patient_id for m in lk.members):
            consent = lk.consent_status
    return [(org, ref.patient_id)], consent, None  # type: ignore[list-item]


@router.post("/data-requests", dependencies=[Depends(data_limiter)])
async def data_request(body: DataRequestIn, request: Request, db: Session = Depends(get_db)):
    started = time.perf_counter()
    rid = request.state.request_id
    app, user = resolve_application(request, db, body.application_id)
    targets, consent, link_id = _targets(db, body.patient)

    decisions, timeline, validation, errors = [], [], [], []
    for org, patient_id in targets:
        d = evaluate(db, app, org, body.resource_types, body.purpose, consent)
        returned = invalid = 0
        job_ids: list[str] = []
        outcome = d.outcome
        if d.allowed_resource_types:
            async with FhirConnector(db, org) as c:
                for rt in d.allowed_resource_types:
                    try:
                        res = await c.get(f"/{rt}", {PATIENT_PARAM[rt]: patient_id, "_count": 200}, request_id=rid, operation=f"read_{rt}")
                    except ConnectorError as e:
                        outcome = "error"
                        job_ids.append(e.job_id or "")
                        errors.append({"organization_id": org.id, "organization_name": org.name, "resource_type": rt, "code": e.code, "message": e.message})
                        continue
                    job_ids.append(res.job_id)
                    bundle_err = validate_bundle(res.data)
                    v = {"organization_id": org.id, "resource_type": rt, "valid": 0, "invalid": 0, "errors": list(bundle_err)}
                    if not bundle_err:
                        for r in bundle_resources(res.data):
                            errs = validate_resource(r, rt)
                            if errs:
                                v["invalid"] += 1
                                v["errors"].extend(e for e in errs if e not in v["errors"])
                                continue
                            v["valid"] += 1
                            title, detail = summarize(r)
                            timeline.append(
                                {
                                    "date": resource_date(r), "resource_type": rt, "title": title, "detail": detail,
                                    "source_organization_id": org.id, "source_organization_name": org.name, "source_resource_id": r["id"],
                                }
                            )
                    returned += v["valid"]
                    invalid += v["invalid"]
                    validation.append(v)
        reason = "; ".join(d.reasons) if outcome != "error" else "Hospital system error during retrieval"
        ev = record_event(
            db,
            request_id=rid,
            action="data_access",
            outcome=outcome,
            organization_id=org.id,
            application_id=app.id,
            actor_id=user.id if user else None,
            resource_types=body.resource_types,
            purpose=body.purpose,
            reason=reason,
            details={
                "allowed": d.allowed_resource_types, "denied": d.denied_resource_types, "returned": returned, "invalid": invalid,
                "policy_results": d.policy_results, "integration_jobs": job_ids, "patient_link_id": link_id, "consent_status": consent,
                "caller": "client_credentials" if not user else "session",
            },
        )
        decisions.append(
            {
                "organization_id": org.id, "organization_name": org.name, "outcome": outcome,
                "allowed_resource_types": d.allowed_resource_types, "denied_resource_types": d.denied_resource_types,
                "reasons": d.reasons, "policy_results": d.policy_results, "audit_event_id": ev.id, "returned": returned,
            }
        )

    timeline.sort(key=lambda t: t["date"] or "", reverse=True)
    outcomes = {d["outcome"] for d in decisions}
    overall = "error" if outcomes == {"error"} else "deny" if outcomes == {"deny"} else "allow" if outcomes == {"allow"} else "partial"
    if overall == "allow" and any(d["denied_resource_types"] for d in decisions):
        overall = "partial"
    return {
        "request_id": rid,
        "application": {"id": app.id, "name": app.name},
        "outcome": overall,
        "decisions": decisions,
        "timeline": timeline,
        "validation": validation,
        "errors": errors,
        "duration_ms": round((time.perf_counter() - started) * 1000, 1),
    }


@router.get("/sandbox/patients")
async def sandbox_patients(request: Request, organization_id: str | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Synthetic test patients available for sandbox requests. Demographics only — no clinical data."""
    q = select(Organization).where(Organization.sandbox_available.is_(True))
    if organization_id:
        q = q.where(Organization.id == organization_id)
    out, errs = [], []
    for org in db.scalars(q.order_by(Organization.name)):
        try:
            async with FhirConnector(db, org) as c:
                res = await c.get("/Patient", {"_count": 15, "_sort": "family"}, request_id=request.state.request_id, operation="sandbox_patient_list")
            if validate_bundle(res.data):
                raise ConnectorError("malformed_response", "Invalid patient list")
            for r in bundle_resources(res.data):
                if r and not validate_resource(r, "Patient"):
                    s = patient_summary(r)
                    out.append({"organization_id": org.id, "organization_name": org.name, "patient_id": s["patient_id"], "name": s["name"], "birth_date": s["birth_date"], "gender": s["gender"], "mrn": s["mrn"], "synthetic": True})
        except ConnectorError as e:
            errs.append({"organization_id": org.id, "organization_name": org.name, "code": e.code, "message": e.message})
    links = []
    for lk in db.scalars(select(PatientLink).where(PatientLink.status == "confirmed")):
        links.append({"link_id": lk.id, "label": lk.label, "consent_status": lk.consent_status, "organizations": [m["organization_id"] for m in lk.members]})
    return {"items": out, "links": links, "errors": errs, "request_id": request.state.request_id}


