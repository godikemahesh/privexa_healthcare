"""Synthetic patient search, explainable cross-organization matching and reviewed patient links."""

import re
from itertools import product
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError, not_found
from ..models import Organization, PatientLink, User
from .audit import record_event
from .auth import ensure_org_access, org_ids_for, require_roles
from .connectors import ConnectorError, FhirConnector
from .fhir import bundle_resources, patient_summary, validate_bundle, validate_resource

router = APIRouter(tags=["patients"])

_SAFE = re.compile(r"^[\w\s'.-]{2,60}$", re.UNICODE)


async def search_org(db: Session, org: Organization, request_id: str, name: str | None, birthdate: str | None, count: int = 25) -> list[dict]:
    params: dict = {"_count": count}
    if name:
        params["name"] = name
    if birthdate:
        params["birthdate"] = birthdate
    async with FhirConnector(db, org) as c:
        res = await c.get("/Patient", params, request_id=request_id, operation="patient_search")
    if validate_bundle(res.data):
        raise ConnectorError("malformed_response", "Hospital system returned an invalid search result", res.job_id)
    out = []
    for r in bundle_resources(res.data):
        if r and not validate_resource(r, "Patient"):
            out.append({**patient_summary(r), "organization_id": org.id, "organization_name": org.name})
    return out


async def search_all(db: Session, orgs: list[Organization], request_id: str, name: str | None, birthdate: str | None):
    results: list[dict] = []
    errors: list[dict] = []
    for org in orgs:  # sequential: the DB session is not shared across tasks
        try:
            results.extend(await search_org(db, org, request_id, name, birthdate))
        except ConnectorError as e:
            errors.append({"organization_id": org.id, "organization_name": org.name, "code": e.code, "message": e.message})
    return results, errors


def _digits(s: str | None) -> str:
    return re.sub(r"\D", "", s or "")[-10:]


def _norm(s: str | None) -> str:
    return re.sub(r"[^a-z]", "", (s or "").lower())


def score_pair(a: dict, b: dict) -> tuple[float, list[dict]]:
    """Deterministic, explainable scoring. Weights sum to 1.0."""
    ex: list[dict] = []

    def add(field: str, result: str, weight: float, note: str):
        ex.append({"field": field, "result": result, "weight": weight, "note": note})

    fa, fb = _norm(a.get("family")), _norm(b.get("family"))
    if fa and fa == fb:
        add("Family name", "match", 0.25, "Identical")
    elif fa and fb and (fa[:4] == fb[:4]):
        add("Family name", "partial", 0.12, "Similar spelling")
    else:
        add("Family name", "mismatch" if fa and fb else "missing", 0.0, "Different" if fa and fb else "Not available")

    ga, gb = _norm((a.get("given") or "").split(" ")[0]), _norm((b.get("given") or "").split(" ")[0])
    if ga and ga == gb:
        add("Given name", "match", 0.15, "Identical")
    elif ga and gb and (ga.startswith(gb) or gb.startswith(ga) or ga[0] == gb[0]):
        add("Given name", "partial", 0.07, "Same initial or shortened form")
    else:
        add("Given name", "mismatch" if ga and gb else "missing", 0.0, "Different" if ga and gb else "Not available")

    da, db_ = a.get("birth_date") or "", b.get("birth_date") or ""
    if da and da == db_:
        add("Date of birth", "match", 0.30, "Identical")
    elif da and db_ and da[:7] == db_[:7]:
        add("Date of birth", "partial", 0.08, "Same month and year")
    else:
        add("Date of birth", "mismatch" if da and db_ else "missing", 0.0, "Different" if da and db_ else "Not available")

    if a.get("gender") and a.get("gender") == b.get("gender"):
        add("Sex", "match", 0.10, "Identical")
    else:
        add("Sex", "mismatch" if a.get("gender") and b.get("gender") else "missing", 0.0, "Different" if a.get("gender") and b.get("gender") else "Not available")

    pa, pb = _digits(a.get("phone")), _digits(b.get("phone"))
    if pa and pa == pb:
        add("Phone", "match", 0.15, "Identical number")
    else:
        add("Phone", "mismatch" if pa and pb else "missing", 0.0, "Different" if pa and pb else "Not available")

    if a.get("postal_code") and a.get("postal_code") == b.get("postal_code"):
        add("Postal code", "match", 0.05, "Identical")
    elif a.get("city") and _norm(a.get("city")) == _norm(b.get("city")):
        add("City", "partial", 0.03, "Same city")
    else:
        add("Location", "mismatch", 0.0, "Different")

    add("Local identifier (MRN)", "mismatch" if a.get("mrn") != b.get("mrn") else "match", 0.0, "Each hospital assigns its own MRN, so it is not used for matching")
    return round(sum(e["weight"] for e in ex), 3), ex


def confidence(score: float) -> str:
    return "high" if score >= 0.8 else "medium" if score >= 0.55 else "low"


def member_key(members: list[dict]) -> str:
    return "|".join(sorted(f"{m['organization_id']}:{m['patient_id']}" for m in members))


def _orgs_for(db: Session, user: User, organization_id: str | None) -> list[Organization]:
    ids = org_ids_for(db, user)
    if organization_id:
        ensure_org_access(db, user, organization_id)
        ids = [organization_id]
    return list(db.scalars(select(Organization).where(Organization.id.in_(ids)).order_by(Organization.name)))


def _strip(rec: dict) -> dict:
    return {k: rec.get(k) for k in ("organization_id", "organization_name", "patient_id", "mrn", "name", "birth_date", "gender", "city", "phone")}


def _check_query(q: str | None) -> None:
    if q is not None and not _SAFE.match(q):
        raise ApiError(422, "validation_error", "Search must be 2–60 letters, spaces, apostrophes, periods or hyphens")


@router.get("/patients/search")
async def search(
    request: Request,
    q: str | None = Query(None),
    birthdate: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    organization_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("provider_admin", "demo_admin")),
):
    _check_query(q)
    if not q and not birthdate:
        raise ApiError(422, "validation_error", "Enter a name or date of birth to search")
    orgs = _orgs_for(db, user, organization_id)
    results, errors = await search_all(db, orgs, request.state.request_id, q, birthdate)
    return {"items": [_strip(r) for r in results], "errors": errors, "request_id": request.state.request_id}


@router.get("/patients/matches")
async def matches(
    request: Request,
    q: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("provider_admin", "demo_admin")),
):
    _check_query(q)
    orgs = _orgs_for(db, user, None)
    if len(orgs) < 2:
        raise ApiError(409, "insufficient_scope", "Cross-organization matching requires access to at least two organizations")
    results, errors = await search_all(db, orgs, request.state.request_id, q, None)
    by_org: dict[str, list[dict]] = {}
    for r in results:
        by_org.setdefault(r["organization_id"], []).append(r)
    links = {lk.member_key: lk for lk in db.scalars(select(PatientLink))}
    cands = []
    org_ids = [o.id for o in orgs]
    for i, oa in enumerate(org_ids):
        for ob in org_ids[i + 1 :]:
            for a, b in product(by_org.get(oa, []), by_org.get(ob, [])):
                score, ex = score_pair(a, b)
                if score < 0.3:
                    continue
                lk = links.get(member_key([a, b]))
                cands.append({"a": _strip(a), "b": _strip(b), "score": score, "confidence": confidence(score), "explanation": ex, "link_id": lk.id if lk else None, "link_status": lk.status if lk else None})
    cands.sort(key=lambda c: -c["score"])
    return {"items": cands[:20], "errors": errors, "request_id": request.state.request_id}


class Member(BaseModel):
    organization_id: str
    patient_id: str = Field(pattern=r"^[A-Za-z0-9\-.]{1,64}$")
    mrn: str | None = Field(default=None, max_length=64)


class LinkIn(BaseModel):
    members: list[Member] = Field(min_length=2, max_length=2)
    decision: Literal["confirm", "reject"]
    label: str = Field(default="Linked synthetic patient", max_length=120)
    score: float = Field(ge=0, le=1)


def link_out(db: Session, lk: PatientLink) -> dict:
    names = {o.id: o.name for o in db.scalars(select(Organization))}
    u = db.get(User, lk.reviewed_by) if lk.reviewed_by else None
    return {
        "id": lk.id, "label": lk.label, "status": lk.status, "score": lk.score, "consent_status": lk.consent_status,
        "members": [{**m, "organization_name": names.get(m["organization_id"])} for m in lk.members],
        "reviewed_by": u.name if u else None, "created_at": lk.created_at,
    }


@router.post("/patient-links", status_code=201)
def review_match(body: LinkIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    members = [m.model_dump() for m in body.members]
    if members[0]["organization_id"] == members[1]["organization_id"]:
        raise ApiError(422, "validation_error", "A link must connect records from two different organizations")
    for m in members:
        ensure_org_access(db, user, m["organization_id"])
    key = member_key(members)
    lk = db.scalar(select(PatientLink).where(PatientLink.member_key == key))
    status = "confirmed" if body.decision == "confirm" else "rejected"
    if lk:
        lk.status, lk.score, lk.reviewed_by, lk.label = status, body.score, user.id, body.label
    else:
        lk = PatientLink(label=body.label, members=members, member_key=key, status=status, score=body.score, reviewed_by=user.id)
        db.add(lk)
    db.commit()
    record_event(db, request_id=request.state.request_id, action="patient_match_reviewed", outcome=status, actor_id=user.id, reason=f"Match {status} (score {body.score:.2f})", details={"patient_link_id": lk.id})
    return link_out(db, lk)


@router.get("/patient-links")
def list_links(db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    allowed = set(org_ids_for(db, user))
    rows = db.scalars(select(PatientLink).order_by(PatientLink.created_at.desc())).all()
    return [link_out(db, lk) for lk in rows if all(m["organization_id"] in allowed for m in lk.members)]


class ConsentIn(BaseModel):
    consent_status: Literal["active", "withdrawn"]


@router.patch("/patient-links/{link_id}/consent")
def set_consent(link_id: str, body: ConsentIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    lk = db.get(PatientLink, link_id)
    if not lk:
        raise not_found("Patient link")
    for m in lk.members:
        ensure_org_access(db, user, m["organization_id"])
    lk.consent_status = body.consent_status
    db.commit()
    record_event(db, request_id=request.state.request_id, action="consent_state_changed", outcome="success", actor_id=user.id, reason=f"Demo consent set to {body.consent_status}", details={"patient_link_id": lk.id})
    return link_out(db, lk)


