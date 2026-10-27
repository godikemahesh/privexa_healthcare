"""Organizations, their connections, health checks and demo fault simulation."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..errors import ApiError, forbidden, not_found
from ..models import IntegrationJob, Organization, User
from .audit import record_event
from .auth import current_user, ensure_org_access, org_ids_for, require_roles
from .connectors import FAULT_MODES, ConnectorError, FhirConnector

router = APIRouter(prefix="/organizations", tags=["organizations"])


class ConnectionOut(BaseModel):
    id: str
    organization_id: str
    status: str
    fault_mode: str
    last_health_check: datetime | None
    last_latency_ms: float | None
    last_error: str | None
    success_count: int
    failure_count: int
    capabilities: dict | None


class OrganizationOut(BaseModel):
    id: str
    slug: str
    name: str
    system_type: str
    fhir_version: str
    simulated: bool
    sandbox_available: bool
    resource_types: list[str]
    connection: ConnectionOut | None = None


def org_out(db: Session, org: Organization, with_connection: bool) -> OrganizationOut:
    o = OrganizationOut(
        id=org.id, slug=org.slug, name=org.name, system_type=org.system_type, fhir_version=org.fhir_version,
        simulated=org.simulated, sandbox_available=org.sandbox_available, resource_types=org.resource_types,
    )
    if with_connection and org.connection:
        c = org.connection
        counts = dict(db.execute(select(IntegrationJob.status, func.count()).where(IntegrationJob.organization_id == org.id).group_by(IntegrationJob.status)).all())
        o.connection = ConnectionOut(
            id=c.id, organization_id=org.id, status=c.status, fault_mode=c.fault_mode, last_health_check=c.last_health_check,
            last_latency_ms=c.last_latency_ms, last_error=c.last_error, success_count=counts.get("success", 0),
            failure_count=counts.get("failure", 0), capabilities=c.capabilities,
        )
    return o


@router.get("", response_model=list[OrganizationOut])
def list_organizations(db: Session = Depends(get_db), user: User = Depends(current_user)):
    orgs = db.scalars(select(Organization).order_by(Organization.name)).all()
    if user.role == "vendor_dev":
        # Vendors see the directory view only — no connection details.
        return [org_out(db, o, False) for o in orgs]
    allowed = set(org_ids_for(db, user))
    return [org_out(db, o, True) for o in orgs if o.id in allowed]


def _org_for(db: Session, user: User, org_id: str) -> Organization:
    org = db.get(Organization, org_id)
    if not org:
        raise not_found("Organization")
    ensure_org_access(db, user, org_id)
    return org


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(org_id: str, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    return org_out(db, _org_for(db, user, org_id), True)


@router.post("/{org_id}/test-connection")
async def test_connection(org_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    org = _org_for(db, user, org_id)
    rid = request.state.request_id
    async with FhirConnector(db, org) as c:
        try:
            caps = await c.capabilities(rid)
        except ConnectorError as e:
            record_event(db, request_id=rid, action="connection_test", outcome="failure", organization_id=org.id, actor_id=user.id, reason=e.message, anchor=False)
            return {"ok": False, "status": org.connection.status, "error": {"code": e.code, "message": e.message}, "request_id": rid, "job_id": e.job_id}
    record_event(db, request_id=rid, action="connection_test", outcome="success", organization_id=org.id, actor_id=user.id, anchor=False)
    return {"ok": True, "status": org.connection.status, "capabilities": caps, "request_id": rid}


@router.get("/{org_id}/capabilities")
async def capabilities(org_id: str, request: Request, refresh: bool = False, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    org = _org_for(db, user, org_id)
    if org.connection.capabilities and not refresh:
        return org.connection.capabilities
    async with FhirConnector(db, org) as c:
        try:
            return await c.capabilities(request.state.request_id)
        except ConnectorError as e:
            raise ApiError(502, e.code, e.message)


class FaultIn(BaseModel):
    mode: Literal["none", "timeout", "error", "malformed", "flaky"]


@router.post("/{org_id}/simulate", response_model=OrganizationOut)
def simulate_fault(org_id: str, body: FaultIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    if not get_settings().demo_mode:
        raise forbidden("Failure simulation is only available in demo mode")
    org = _org_for(db, user, org_id)
    assert body.mode in FAULT_MODES
    org.connection.fault_mode = body.mode
    if body.mode == "none":
        org.connection.last_error = None
    db.commit()
    record_event(db, request_id=request.state.request_id, action="failure_simulation", outcome="success", organization_id=org.id, actor_id=user.id, reason=f"Simulated condition set to '{body.mode}'", anchor=False)
    return org_out(db, org, True)


@router.get("/{org_id}/activity")
def recent_activity(org_id: str, db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    _org_for(db, user, org_id)
    rows = db.scalars(select(IntegrationJob).where(IntegrationJob.organization_id == org_id).order_by(IntegrationJob.created_at.desc()).limit(20)).all()
    return [
        {"id": j.id, "request_id": j.request_id, "operation": j.operation, "status": j.status, "attempts": j.attempts, "latency_ms": j.latency_ms, "error_code": j.error_code, "error_message": j.error_message, "created_at": j.created_at}
        for j in rows
    ]
