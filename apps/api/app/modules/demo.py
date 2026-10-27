"""Demo scenario metadata and reset. Only available when DEMO_MODE is enabled."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..errors import ApiError
from ..models import Application, AuditEvent, Connection, Organization, PatientLink, User
from .audit import record_event
from .auth import current_user, require_roles

router = APIRouter(prefix="/demo", tags=["demo"])

# Fictional cross-hospital patient created by simulator/seed.py.
SCENARIO_FAMILY_NAME = "Krishnan"


def _enabled():
    if not get_settings().demo_mode:
        raise ApiError(404, "not_found", "Demo mode is disabled")


@router.get("/scenario", dependencies=[Depends(_enabled)])
def scenario(db: Session = Depends(get_db), user: User = Depends(current_user)):
    orgs = db.scalars(select(Organization).order_by(Organization.slug)).all()
    apps = db.scalars(select(Application).where(Application.simulated.is_(True), Application.listed.is_(True)).order_by(Application.name)).all()
    return {
        "organizations": [{"id": o.id, "slug": o.slug, "name": o.name} for o in orgs],
        "applications": [{"id": a.id, "name": a.name, "purpose": a.purpose, "requested_resource_types": a.requested_resource_types, "client_id": a.client_id} for a in apps],
        "patient_search": SCENARIO_FAMILY_NAME,
    }


@router.post("/reset", dependencies=[Depends(_enabled)])
def reset(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("demo_admin"))):
    """Clear simulated faults, restore consent and undo demo tampering. Audit history is kept."""
    for c in db.scalars(select(Connection)):
        c.fault_mode, c.last_error = "none", None
    for lk in db.scalars(select(PatientLink)):
        lk.consent_status = "active"
    for ev in db.scalars(select(AuditEvent)):
        orig = (ev.details or {}).get("_original_outcome")
        if orig:
            ev.outcome = orig
            ev.details = {k: v for k, v in ev.details.items() if k != "_original_outcome"}
    db.commit()
    record_event(db, request_id=request.state.request_id, action="demo_reset", outcome="success", actor_id=user.id, anchor=False)
    return {"ok": True}
