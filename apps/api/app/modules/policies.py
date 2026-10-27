"""Policies and the access-decision engine (Privexa Trust).

Decision order (default deny):
  1. the application must be active;
  2. an approved access request (grant) must exist for the application and organization;
  3. the stated purpose must match the grant;
  4. each resource type must be inside the granted scope;
  5. every enabled organization policy is applied (deny rules and consent requirements).
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError, not_found
from ..models import AccessRequest, Application, Organization, Policy, PolicyVersion, User
from .audit import record_event
from .auth import ensure_org_access, org_ids_for, require_roles
from .fhir import SUPPORTED_RESOURCE_TYPES

router = APIRouter(prefix="/policies", tags=["policies"])

PURPOSES = ("care_coordination", "treatment", "research", "analytics")
Purpose = Literal["care_coordination", "treatment", "research", "analytics"]


class PolicyRule(BaseModel):
    effect: Literal["deny"] = "deny"
    resource_types: list[str] = Field(default_factory=list)
    purposes: list[Purpose] = Field(default_factory=list)
    application_ids: list[str] = Field(default_factory=list)
    require_active_consent: bool = False

    @field_validator("resource_types")
    @classmethod
    def _rt(cls, v: list[str]) -> list[str]:
        bad = [r for r in v if r not in SUPPORTED_RESOURCE_TYPES]
        if bad:
            raise ValueError(f"Unsupported resource types: {', '.join(bad)}")
        return v


@dataclass
class Decision:
    organization_id: str
    organization_name: str
    outcome: str  # allow | deny
    allowed_resource_types: list[str] = field(default_factory=list)
    denied_resource_types: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    policy_results: list[dict] = field(default_factory=list)
    grant_id: str | None = None


def active_grant(db: Session, app_id: str, org_id: str) -> AccessRequest | None:
    return db.scalar(
        select(AccessRequest)
        .where(AccessRequest.application_id == app_id, AccessRequest.organization_id == org_id, AccessRequest.status == "approved")
        .order_by(AccessRequest.updated_at.desc())
        .limit(1)
    )


def evaluate(db: Session, app: Application, org: Organization, resource_types: list[str], purpose: str, consent_status: str = "active") -> Decision:
    d = Decision(organization_id=org.id, organization_name=org.name, outcome="deny")
    requested = list(dict.fromkeys(resource_types))

    def deny_all(reason: str) -> Decision:
        d.denied_resource_types = requested
        d.reasons.append(reason)
        return d

    if app.status != "active":
        return deny_all(f"Application '{app.name}' is {app.status}")
    grant = active_grant(db, app.id, org.id)
    if not grant:
        return deny_all(f"'{app.name}' has no approved access to {org.name}")
    d.grant_id = grant.id
    if purpose != grant.purpose:
        return deny_all(f"Purpose '{purpose}' is not approved (approved purpose: '{grant.purpose}')")

    allowed: list[str] = []
    for rt in requested:
        if rt in grant.resource_types:
            allowed.append(rt)
        else:
            d.denied_resource_types.append(rt)
            d.reasons.append(f"{rt} is outside the application's approved scope")

    policies = db.scalars(select(Policy).where(Policy.organization_id == org.id).order_by(Policy.name)).all()
    for p in policies:
        rule = p.rule or {}
        applies = p.enabled and (not rule.get("application_ids") or app.id in rule["application_ids"]) and (not rule.get("purposes") or purpose in rule["purposes"])
        effect_types: list[str] = []
        if applies:
            if rule.get("require_active_consent") and consent_status != "active":
                effect_types = list(allowed) if not rule.get("resource_types") else [r for r in allowed if r in rule["resource_types"]]
                if effect_types:
                    d.reasons.append(f"Policy '{p.name}' requires active consent (consent is {consent_status})")
            elif not rule.get("require_active_consent") and rule.get("resource_types"):
                effect_types = [r for r in allowed if r in rule["resource_types"]]
                if effect_types:
                    d.reasons.append(f"Policy '{p.name}' denies {', '.join(effect_types)}")
        for r in effect_types:
            allowed.remove(r)
            d.denied_resource_types.append(r)
        d.policy_results.append({"policy": p.name, "policy_id": p.id, "version": p.version, "enabled": p.enabled, "matched": bool(effect_types), "effect": "deny" if effect_types else "none"})

    d.allowed_resource_types = allowed
    d.outcome = "allow" if allowed else "deny"
    if allowed and not d.reasons:
        d.reasons.append("All requested resources are within the approved scope and policies")
    return d


# ---------- API ----------


class PolicyOut(BaseModel):
    id: str
    organization_id: str
    name: str
    description: str
    enabled: bool
    version: int
    rule: dict
    updated_at: datetime


class PolicyCreate(BaseModel):
    organization_id: str
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=500)
    enabled: bool = True
    rule: PolicyRule


class PolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    enabled: bool | None = None
    rule: PolicyRule | None = None


def _snapshot(db: Session, p: Policy, user: User | None) -> None:
    db.add(PolicyVersion(policy_id=p.id, version=p.version, enabled=p.enabled, rule=p.rule, changed_by=user.id if user else None))


@router.get("", response_model=list[PolicyOut])
def list_policies(organization_id: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    ids = org_ids_for(db, user)
    if organization_id:
        ensure_org_access(db, user, organization_id)
        ids = [organization_id]
    return db.scalars(select(Policy).where(Policy.organization_id.in_(ids)).order_by(Policy.name)).all()


@router.post("", response_model=PolicyOut, status_code=201)
def create_policy(body: PolicyCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    ensure_org_access(db, user, body.organization_id)
    p = Policy(organization_id=body.organization_id, name=body.name, description=body.description, enabled=body.enabled, rule=body.rule.model_dump(), version=1)
    db.add(p)
    db.flush()
    _snapshot(db, p, user)
    db.commit()
    record_event(db, request_id=request.state.request_id, action="policy_created", outcome="success", organization_id=p.organization_id, actor_id=user.id, reason=f"Policy '{p.name}' v1 created")
    return p


@router.patch("/{policy_id}", response_model=PolicyOut)
def update_policy(policy_id: str, body: PolicyUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    p = db.get(Policy, policy_id)
    if not p:
        raise not_found("Policy")
    ensure_org_access(db, user, p.organization_id)
    changes = []
    if body.name is not None and body.name != p.name:
        p.name = body.name
        changes.append("name")
    if body.description is not None and body.description != p.description:
        p.description = body.description
        changes.append("description")
    if body.enabled is not None and body.enabled != p.enabled:
        p.enabled = body.enabled
        changes.append("enabled" if body.enabled else "disabled")
    if body.rule is not None and body.rule.model_dump() != p.rule:
        p.rule = body.rule.model_dump()
        changes.append("rule")
    if not changes:
        return p
    p.version += 1
    _snapshot(db, p, user)
    db.commit()
    record_event(db, request_id=request.state.request_id, action="policy_updated", outcome="success", organization_id=p.organization_id, actor_id=user.id, reason=f"Policy '{p.name}' updated to v{p.version}: {', '.join(changes)}")
    return p


@router.get("/{policy_id}/versions")
def policy_versions(policy_id: str, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    p = db.get(Policy, policy_id)
    if not p:
        raise not_found("Policy")
    ensure_org_access(db, user, p.organization_id)
    rows = db.scalars(select(PolicyVersion).where(PolicyVersion.policy_id == p.id).order_by(PolicyVersion.version.desc())).all()
    out = []
    for v in rows:
        u = db.get(User, v.changed_by) if v.changed_by else None
        out.append({"version": v.version, "enabled": v.enabled, "rule": v.rule, "changed_by": u.name if u else "System", "created_at": v.created_at})
    return out


class EvaluateIn(BaseModel):
    organization_id: str
    application_id: str
    resource_types: list[str] = Field(min_length=1)
    purpose: Purpose
    consent_status: Literal["active", "withdrawn"] = "active"


@router.post("/evaluate")
def test_policy(body: EvaluateIn, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    """Dry run: would this request be allowed? Nothing is retrieved and no data is returned."""
    ensure_org_access(db, user, body.organization_id)
    org = db.get(Organization, body.organization_id)
    app = db.get(Application, body.application_id)
    if not org or not app:
        raise not_found("Organization or application")
    unknown = [r for r in body.resource_types if r not in SUPPORTED_RESOURCE_TYPES]
    if unknown:
        raise ApiError(422, "validation_error", f"Unsupported resource types: {', '.join(unknown)}")
    d = evaluate(db, app, org, body.resource_types, body.purpose, body.consent_status)
    return d.__dict__
