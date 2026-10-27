from app.db import SessionLocal
from app.models import AuditEvent
from app.modules.audit import canonical_payload, compute_fingerprint, record_event


def _event():
    db = SessionLocal()
    ev = record_event(db, request_id="req_unit01", action="data_access", outcome="allow", resource_types=["Observation", "Encounter"], purpose="care_coordination", reason="ok", details={"patient_link_id": "secret-link"})
    return db, ev


def test_fingerprint_is_stable_and_sha256():
    db, ev = _event()
    db.expire_all()
    reloaded = db.get(AuditEvent, ev.id)
    assert reloaded.fingerprint == compute_fingerprint(reloaded)
    assert reloaded.fingerprint.startswith("0x") and len(reloaded.fingerprint) == 66


def test_canonical_payload_excludes_details_and_sorts():
    db, ev = _event()
    payload = canonical_payload(ev)
    assert "secret-link" not in payload  # details (incl. patient references) never enter the fingerprint
    assert '"resource_types":["Encounter","Observation"]' in payload


def test_modification_changes_fingerprint():
    db, ev = _event()
    before = compute_fingerprint(ev)
    ev.outcome = "deny"
    assert compute_fingerprint(ev) != before


def test_event_starts_with_pending_anchor():
    db, ev = _event()
    assert ev.anchor is not None and ev.anchor.status == "pending"
