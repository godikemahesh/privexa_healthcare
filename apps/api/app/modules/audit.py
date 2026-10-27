"""Audit events and their integrity fingerprints."""

import hashlib
import json
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..errors import ApiError, forbidden, not_found
from ..models import Application, AuditEvent, BlockchainAnchor, Organization, User
from .auth import current_user, org_ids_for, require_roles

router = APIRouter(prefix="/audit-events", tags=["audit"])

# Only these fields are part of the fingerprint. They contain no patient identifiers or clinical content.
FINGERPRINT_FIELDS = ("id", "request_id", "action", "outcome", "organization_id", "application_id", "actor_id", "resource_types", "purpose", "reason", "created_at")


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def canonical_payload(ev: AuditEvent) -> str:
    data = {
        "id": ev.id,
        "request_id": ev.request_id,
        "action": ev.action,
        "outcome": ev.outcome,
        "organization_id": ev.organization_id,
        "application_id": ev.application_id,
        "actor_id": ev.actor_id,
        "resource_types": sorted(ev.resource_types or []),
        "purpose": ev.purpose,
        "reason": ev.reason,
        "created_at": _iso(ev.created_at),
    }
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def compute_fingerprint(ev: AuditEvent) -> str:
    return "0x" + hashlib.sha256(canonical_payload(ev).encode()).hexdigest()


def record_event(
    db: Session,
    *,
    request_id: str,
    action: str,
    outcome: str,
    organization_id: str | None = None,
    application_id: str | None = None,
    actor_id: str | None = None,
    resource_types: list[str] | None = None,
    purpose: str | None = None,
    reason: str | None = None,
    details: dict | None = None,
    anchor: bool = True,
) -> AuditEvent:
    ts = datetime.now(timezone.utc)
    ev = AuditEvent(
        request_id=request_id,
        action=action,
        outcome=outcome,
        organization_id=organization_id,
        application_id=application_id,
        actor_id=actor_id,
        resource_types=sorted(resource_types or []),
        purpose=purpose,
        reason=(reason or None) and reason[:500],
        details=details or {},
        created_at=ts.replace(microsecond=ts.microsecond // 1000 * 1000),  # millisecond precision survives every DB round trip
        fingerprint="",
    )
    db.add(ev)
    db.flush()
    ev.fingerprint = compute_fingerprint(ev)
    if anchor and get_settings().anchor_enabled:
        db.add(BlockchainAnchor(audit_event_id=ev.id, fingerprint=ev.fingerprint, status="pending"))
    db.commit()
    return ev


# ---------- API ----------


class AuditEventOut(BaseModel):
    id: str
    request_id: str
    action: str
    outcome: str
    organization_id: str | None
    organization_name: str | None
    application_id: str | None
    application_name: str | None
    actor: str | None
    resource_types: list[str]
    purpose: str | None
    reason: str | None
    details: dict
    created_at: datetime
    fingerprint: str
    anchor_status: Literal["not_anchored", "pending", "anchored", "failed"]
    anchor_tx_hash: str | None
    anchor_block: int | None
    anchor_error: str | None
    verification: str | None
    verified_at: datetime | None


def event_out(db: Session, ev: AuditEvent) -> AuditEventOut:
    org = db.get(Organization, ev.organization_id) if ev.organization_id else None
    app = db.get(Application, ev.application_id) if ev.application_id else None
    actor = db.get(User, ev.actor_id) if ev.actor_id else None
    a = ev.anchor
    return AuditEventOut(
        id=ev.id,
        request_id=ev.request_id,
        action=ev.action,
        outcome=ev.outcome,
        organization_id=ev.organization_id,
        organization_name=org.name if org else None,
        application_id=ev.application_id,
        application_name=app.name if app else None,
        actor=actor.name if actor else None,
        resource_types=ev.resource_types or [],
        purpose=ev.purpose,
        reason=ev.reason,
        details=ev.details or {},
        created_at=ev.created_at,
        fingerprint=ev.fingerprint,
        anchor_status=a.status if a else "not_anchored",  # type: ignore[arg-type]
        anchor_tx_hash=a.tx_hash if a else None,
        anchor_block=a.block_number if a else None,
        anchor_error=a.error if a else None,
        verification=a.last_verification if a else None,
        verified_at=a.verified_at if a else None,
    )


def scope_query(db: Session, user: User, q):
    """Providers see events for their organizations; vendors see events for their applications."""
    if user.role == "demo_admin":
        return q
    if user.role == "provider_admin":
        return q.where(AuditEvent.organization_id.in_(org_ids_for(db, user)))
    app_ids = list(db.scalars(select(Application.id).where(Application.owner_id == user.id)))
    return q.where(or_(AuditEvent.application_id.in_(app_ids), AuditEvent.actor_id == user.id))


def can_view(db: Session, user: User, ev: AuditEvent) -> bool:
    q = scope_query(db, user, select(AuditEvent.id).where(AuditEvent.id == ev.id))
    return db.scalar(q) is not None


@router.get("")
def list_events(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    organization_id: str | None = None,
    application_id: str | None = None,
    action: str | None = None,
    outcome: str | None = None,
    anchor_status: str | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    request_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    q = scope_query(db, user, select(AuditEvent))
    if organization_id:
        q = q.where(AuditEvent.organization_id == organization_id)
    if application_id:
        q = q.where(AuditEvent.application_id == application_id)
    if action:
        q = q.where(AuditEvent.action == action)
    if outcome:
        q = q.where(AuditEvent.outcome == outcome)
    if request_id:
        q = q.where(AuditEvent.request_id == request_id)
    if since:
        q = q.where(AuditEvent.created_at >= since)
    if until:
        q = q.where(AuditEvent.created_at <= until)
    if anchor_status:
        if anchor_status == "not_anchored":
            q = q.outerjoin(BlockchainAnchor).where(BlockchainAnchor.id.is_(None))
        else:
            q = q.join(BlockchainAnchor).where(BlockchainAnchor.status == anchor_status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(AuditEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [event_out(db, e) for e in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/actions")
def list_actions(db: Session = Depends(get_db), user: User = Depends(current_user)):
    q = scope_query(db, user, select(AuditEvent.action).distinct())
    return sorted(db.scalars(q).all())


@router.get("/{event_id}", response_model=AuditEventOut)
def get_event(event_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ev = db.get(AuditEvent, event_id)
    if not ev or not can_view(db, user, ev):
        raise not_found("Audit event")
    return event_out(db, ev)


@router.post("/{event_id}/verify")
def verify_event(event_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    from .blockchain import verify

    ev = db.get(AuditEvent, event_id)
    if not ev or not can_view(db, user, ev):
        raise not_found("Audit event")
    return verify(db, ev)


@router.post("/{event_id}/anchor")
def retry_anchor(event_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Queue the event for (re)anchoring; the anchor worker submits it."""
    ev = db.get(AuditEvent, event_id)
    if not ev or not can_view(db, user, ev):
        raise not_found("Audit event")
    a = ev.anchor
    if a and a.status == "anchored":
        raise ApiError(409, "already_anchored", "This event is already anchored")
    if not a:
        a = BlockchainAnchor(audit_event_id=ev.id, fingerprint=ev.fingerprint, status="pending")
        db.add(a)
    a.status, a.error = "pending", None
    db.commit()
    return {"status": "pending"}


# Demo-only: simulate an unauthorized modification of a stored audit record to show tamper detection.
class TamperIn(BaseModel):
    restore: bool = False


@router.post("/{event_id}/demo-tamper", dependencies=[Depends(require_roles("demo_admin"))])
def demo_tamper(event_id: str, body: TamperIn, request: Request, db: Session = Depends(get_db)):
    if not get_settings().demo_mode:
        raise forbidden("Demo scenarios are disabled")
    ev = db.get(AuditEvent, event_id)
    if not ev:
        raise not_found("Audit event")
    original = (ev.details or {}).get("_original_outcome")
    if body.restore:
        if original:
            ev.outcome = original
            ev.details = {k: v for k, v in ev.details.items() if k != "_original_outcome"}
    elif not original:
        ev.details = {**(ev.details or {}), "_original_outcome": ev.outcome}
        ev.outcome = "deny" if ev.outcome == "allow" else "allow"
    db.commit()
    return {"outcome": ev.outcome, "tampered": not body.restore}


def latest_anchor_summary(db: Session, org_ids: list[str] | None) -> dict:
    q = select(BlockchainAnchor.status, func.count()).join(AuditEvent)
    if org_ids is not None:
        q = q.where(AuditEvent.organization_id.in_(org_ids))
    counts = dict(db.execute(q.group_by(BlockchainAnchor.status)).all())
    lq = select(BlockchainAnchor).join(AuditEvent).where(BlockchainAnchor.status == "anchored")
    if org_ids is not None:
        lq = lq.where(AuditEvent.organization_id.in_(org_ids))
    last = db.scalar(lq.order_by(BlockchainAnchor.updated_at.desc()).limit(1))
    return {
        "anchored": counts.get("anchored", 0),
        "pending": counts.get("pending", 0),
        "failed": counts.get("failed", 0),
        "last_block": last.block_number if last else None,
        "last_tx_hash": last.tx_hash if last else None,
        "last_anchored_at": last.updated_at if last else None,
    }

