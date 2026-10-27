"""Integration metrics computed from recorded connector jobs."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import IntegrationJob, Organization, User
from .auth import ensure_org_access, org_ids_for, require_roles

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def compute_metrics(db: Session, org_ids: list[str], hours: int) -> dict:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    jobs = db.scalars(select(IntegrationJob).where(IntegrationJob.organization_id.in_(org_ids), IntegrationJob.created_at >= since)).all()
    orgs = {o.id: o.name for o in db.scalars(select(Organization).where(Organization.id.in_(org_ids)))}
    per: dict[str, list[IntegrationJob]] = defaultdict(list)
    for j in jobs:
        per[j.organization_id].append(j)
    out = []
    for oid in org_ids:
        js = per.get(oid, [])
        lat = sorted(j.latency_ms for j in js if j.latency_ms is not None and j.status == "success")
        fails = sum(1 for j in js if j.status == "failure")
        out.append(
            {
                "organization_id": oid,
                "organization_name": orgs.get(oid, oid),
                "requests": len(js),
                "failures": fails,
                "retries": sum(max(0, j.attempts - 1) for j in js),
                "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
                "p95_latency_ms": lat[min(len(lat) - 1, int(len(lat) * 0.95))] if lat else None,
                "success_rate": round((len(js) - fails) / len(js), 4) if js else None,
            }
        )
    bucket_minutes = 60 if hours > 6 else 10
    series: dict[tuple[str, str], dict] = {}
    for j in jobs:
        t = _aware(j.created_at)
        b = t.replace(minute=(t.minute // bucket_minutes) * bucket_minutes, second=0, microsecond=0).isoformat()
        s = series.setdefault((b, j.organization_id), {"bucket": b, "organization_id": j.organization_id, "requests": 0, "failures": 0, "_lat": []})
        s["requests"] += 1
        s["failures"] += j.status == "failure"
        if j.latency_ms is not None and j.status == "success":
            s["_lat"].append(j.latency_ms)
    ser = []
    for s in sorted(series.values(), key=lambda x: x["bucket"]):
        lat = s.pop("_lat")
        s["avg_latency_ms"] = round(sum(lat) / len(lat), 1) if lat else None
        ser.append(s)
    return {"window_hours": hours, "bucket_minutes": bucket_minutes, "per_organization": out, "series": ser}


@router.get("/metrics")
def metrics(
    organization_id: str | None = None,
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("provider_admin", "demo_admin")),
):
    ids = org_ids_for(db, user)
    if organization_id:
        ensure_org_access(db, user, organization_id)
        ids = [organization_id]
    return compute_metrics(db, ids, hours)


@router.get("/jobs")
def jobs(
    organization_id: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("provider_admin", "demo_admin")),
):
    ids = org_ids_for(db, user)
    if organization_id:
        ensure_org_access(db, user, organization_id)
        ids = [organization_id]
    q = select(IntegrationJob).where(IntegrationJob.organization_id.in_(ids))
    if status:
        q = q.where(IntegrationJob.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(IntegrationJob.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    names = {o.id: o.name for o in db.scalars(select(Organization))}
    return {
        "items": [
            {
                "id": j.id, "request_id": j.request_id, "organization_id": j.organization_id, "organization_name": names.get(j.organization_id),
                "operation": j.operation, "status": j.status, "attempts": j.attempts, "attempt_log": j.attempt_log, "latency_ms": j.latency_ms,
                "error_code": j.error_code, "error_message": j.error_message, "created_at": j.created_at,
            }
            for j in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
