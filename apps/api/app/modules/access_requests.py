"""Vendor access requests to organizations. An approved request is the application's grant (scopes + purpose)."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError, not_found
from ..models import AccessRequest, Application, Organization, User
from .audit import record_event
from .auth import current_user, ensure_org_access, org_ids_for, require_roles
from .fhir import CLINICAL_RESOURCE_TYPES
from .policies import Purpose

router = APIRouter(prefix="/access-requests", tags=["access requests"])

# Allowed transitions: action -> (from statuses, to status)
TRANSITIONS: dict[str, tuple[set[str], str]] = {
    "start_review": ({"submitted"}, "under_review"),
    "approve": ({"submitted", "under_review"}, "approved"),
    "reject": ({"submitted", "under_review"}, "rejected"),
    "revoke": ({"approved"}, "revoked"),
}


class AccessRequestOut(BaseModel):
    id: str
    application_id: str
    application_name: str
    vendor_name: str
    organization_id: str
    organization_name: str
    resource_types: list[str]
    purpose: str
    justification: str
    status: str
    decision_reason: str | None
    created_at: datetime
    updated_at: datetime


def out(r: AccessRequest) -> AccessRequestOut:
    return AccessRequestOut(
        id=r.id,
        application_id=r.application_id,
        application_name=r.application.name,
        vendor_name=r.application.vendor_name,
        organization_id=r.organization_id,
        organization_name=r.organization.name,
        resource_types=r.resource_types,
        purpose=r.purpose,
        justification=r.justification,
        status=r.status,
        decision_reason=r.decision_reason,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def scoped(db: Session, user: User):
    q = select(AccessRequest)
    if user.role == "vendor_dev":
        return q.join(Application).where(Application.owner_id == user.id)
    if user.role == "provider_admin":
        return q.where(AccessRequest.organization_id.in_(org_ids_for(db, user)), AccessRequest.status != "draft")
    return q


class CreateIn(BaseModel):
    application_id: str
    organization_id: str
    resource_types: list[str] = Field(min_length=1)
    purpose: Purpose
    justification: str = Field(default="", max_length=1000)
    submit: bool = True

    @field_validator("resource_types")
    @classmethod
    def _rt(cls, v: list[str]) -> list[str]:
        bad = [r for r in v if r not in CLINICAL_RESOURCE_TYPES]
        if bad:
            raise ValueError(f"Unsupported resource types: {', '.join(bad)}")
        return sorted(set(v))


@router.get("")
def list_requests(
    status: str | None = None,
    organization_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    q = scoped(db, user)
    if status:
        q = q.where(AccessRequest.status == status)
    if organization_id:
        q = q.where(AccessRequest.organization_id == organization_id)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(AccessRequest.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [out(r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=AccessRequestOut, status_code=201)
def create_request(body: CreateIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("vendor_dev", "demo_admin"))):
    app = db.get(Application, body.application_id)
    if not app or (user.role == "vendor_dev" and app.owner_id != user.id):
        raise not_found("Application")
    org = db.get(Organization, body.organization_id)
    if not org:
        raise not_found("Organization")
    open_req = db.scalar(
        select(AccessRequest).where(
            AccessRequest.application_id == app.id,
            AccessRequest.organization_id == org.id,
            AccessRequest.status.in_(["submitted", "under_review"]),
        )
    )
    if open_req:
        raise ApiError(409, "duplicate_request", "An access request for this organization is already in review")
    r = AccessRequest(
        application_id=app.id,
        organization_id=org.id,
        resource_types=body.resource_types,
        purpose=body.purpose,
        justification=body.justification,
        status="submitted" if body.submit else "draft",
    )
    db.add(r)
    db.commit()
    record_event(db, request_id=request.state.request_id, action="access_request_" + r.status, outcome="success", organization_id=org.id, application_id=app.id, actor_id=user.id, resource_types=r.resource_types, purpose=r.purpose)
    return out(r)


@router.post("/{req_id}/submit", response_model=AccessRequestOut)
def submit_request(req_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("vendor_dev", "demo_admin"))):
    r = db.scalar(scoped(db, user).where(AccessRequest.id == req_id))
    if not r:
        raise not_found("Access request")
    if r.status != "draft":
        raise ApiError(409, "invalid_transition", f"Only drafts can be submitted (current status: {r.status})")
    r.status = "submitted"
    db.commit()
    record_event(db, request_id=request.state.request_id, action="access_request_submitted", outcome="success", organization_id=r.organization_id, application_id=r.application_id, actor_id=user.id, resource_types=r.resource_types, purpose=r.purpose)
    return out(r)


class ReviewIn(BaseModel):
    action: Literal["start_review", "approve", "reject", "revoke"]
    reason: str | None = Field(default=None, max_length=300)


@router.post("/{req_id}/review", response_model=AccessRequestOut)
def review_request(req_id: str, body: ReviewIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    r = db.get(AccessRequest, req_id)
    if not r:
        raise not_found("Access request")
    ensure_org_access(db, user, r.organization_id)
    allowed_from, to = TRANSITIONS[body.action]
    if r.status not in allowed_from:
        raise ApiError(409, "invalid_transition", f"Cannot {body.action.replace('_', ' ')} a request that is {r.status.replace('_', ' ')}")
    if body.action in ("reject", "revoke") and not (body.reason and body.reason.strip()):
        raise ApiError(422, "validation_error", "A reason is required", [{"field": "reason", "message": "A reason is required"}])
    if body.action == "approve":
        # Approving supersedes earlier grants for the same app and organization.
        for prev in db.scalars(select(AccessRequest).where(AccessRequest.application_id == r.application_id, AccessRequest.organization_id == r.organization_id, AccessRequest.status == "approved")):
            prev.status, prev.decision_reason = "revoked", "Superseded by a newer approval"
    r.status = to
    r.reviewed_by = user.id
    r.decision_reason = body.reason or ("Approved for demonstration" if to == "approved" else r.decision_reason)
    db.commit()
    record_event(db, request_id=request.state.request_id, action=f"access_request_{to}", outcome="success", organization_id=r.organization_id, application_id=r.application_id, actor_id=user.id, resource_types=r.resource_types, purpose=r.purpose, reason=r.decision_reason)
    return out(r)


