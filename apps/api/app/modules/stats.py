"""Overview figures for the provider and vendor workspaces, computed from live records."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AccessRequest, Application, AuditEvent, Connection, IntegrationJob, Organization, User
from .audit import event_out, latest_anchor_summary
from .auth import org_ids_for, require_roles
from .monitoring import compute_metrics

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/provider")
def provider_stats(db: Session = Depends(get_db), user: User = Depends(require_roles("provider_admin", "demo_admin"))):
    ids = org_ids_for(db, user)
    conns = db.scalars(select(Connection).where(Connection.organization_id.in_(ids))).all()
    reqs = dict(db.execute(select(AccessRequest.status, func.count()).where(AccessRequest.organization_id.in_(ids)).group_by(AccessRequest.status)).all())
    active_apps = db.scalar(
        select(func.count(func.distinct(AccessRequest.application_id)))
        .join(Application)
        .where(AccessRequest.organization_id.in_(ids), AccessRequest.status == "approved", Application.status == "active")
    )
    decisions = dict(db.execute(select(AuditEvent.outcome, func.count()).where(AuditEvent.organization_id.in_(ids), AuditEvent.action == "data_access").group_by(AuditEvent.outcome)).all())
    recent = db.scalars(select(AuditEvent).where(AuditEvent.organization_id.in_(ids)).order_by(AuditEvent.created_at.desc()).limit(8)).all()
    errors = db.scalars(select(IntegrationJob).where(IntegrationJob.organization_id.in_(ids), IntegrationJob.status == "failure").order_by(IntegrationJob.created_at.desc()).limit(5)).all()
    names = {o.id: o.name for o in db.scalars(select(Organization))}
    m = compute_metrics(db, ids, 24)
    total = sum(o["requests"] for o in m["per_organization"])
    fails = sum(o["failures"] for o in m["per_organization"])
    return {
        "connections": [{"organization_id": c.organization_id, "organization_name": names.get(c.organization_id), "status": c.status, "fault_mode": c.fault_mode, "last_health_check": c.last_health_check} for c in conns],
        "active_applications": active_apps or 0,
        "pending_requests": reqs.get("submitted", 0) + reqs.get("under_review", 0),
        "requests_by_status": reqs,
        "allowed": decisions.get("allow", 0),
        "denied": decisions.get("deny", 0),
        "errored": decisions.get("error", 0),
        "success_rate_24h": round((total - fails) / total, 4) if total else None,
        "connector_calls_24h": total,
        "recent_activity": [event_out(db, e) for e in recent],
        "integration_errors": [
            {"id": j.id, "organization_name": names.get(j.organization_id), "operation": j.operation, "error_code": j.error_code, "error_message": j.error_message, "attempts": j.attempts, "created_at": j.created_at, "request_id": j.request_id}
            for j in errors
        ],
        "anchors": latest_anchor_summary(db, ids),
        "series": m["series"],
    }


@router.get("/vendor")
def vendor_stats(db: Session = Depends(get_db), user: User = Depends(require_roles("vendor_dev", "demo_admin"))):
    app_q = select(Application.id)
    if user.role == "vendor_dev":
        app_q = app_q.where(Application.owner_id == user.id)
    app_ids = list(db.scalars(app_q))
    reqs = dict(db.execute(select(AccessRequest.status, func.count()).where(AccessRequest.application_id.in_(app_ids)).group_by(AccessRequest.status)).all())
    events = db.scalars(select(AuditEvent).where(AuditEvent.application_id.in_(app_ids), AuditEvent.action == "data_access").order_by(AuditEvent.created_at.desc())).all()
    passed = sum(1 for e in events if (e.details or {}).get("invalid", 0) == 0 and e.outcome != "error")
    return {
        "applications": len(app_ids),
        "sandbox_requests": len(events),
        "allowed": sum(1 for e in events if e.outcome == "allow"),
        "denied": sum(1 for e in events if e.outcome == "deny"),
        "validation_passed": passed,
        "validation_failed": len(events) - passed,
        "requests_by_status": reqs,
        "recent_tests": [event_out(db, e) for e in events[:8]],
        "available_integrations": db.scalar(select(func.count()).select_from(Organization).where(Organization.sandbox_available.is_(True))) or 0,
    }
