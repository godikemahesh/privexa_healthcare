import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import AuditEvent

from ..conftest import login_as

API = "/api/v1"


def _link(client, ids):
    r = client.post(f"{API}/patient-links", json={
        "members": [{"organization_id": ids["orgs"]["metrocare"], "patient_id": "a-1"}, {"organization_id": ids["orgs"]["sunrise"], "patient_id": "b-1"}],
        "decision": "confirm", "score": 0.95, "label": "Amara Okafor (synthetic)",
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _request(client, app_id, link_id, types=("Observation", "Encounter", "Condition", "MedicationRequest"), purpose="care_coordination"):
    return client.post(f"{API}/data-requests", json={"application_id": app_id, "patient": {"link_id": link_id}, "resource_types": list(types), "purpose": purpose})


# ---------- authentication & roles ----------


def test_protected_routes_require_sign_in(anon):
    for path in ("/organizations", "/audit-events", "/stats/provider", "/applications"):
        assert anon.get(API + path).status_code == 401


def test_writes_require_csrf_token(provider, ids):
    provider.headers.pop("X-CSRF-Token")
    r = provider.post(f"{API}/organizations/{ids['orgs']['metrocare']}/test-connection")
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


def test_vendor_cannot_use_provider_endpoints(vendor, ids):
    assert vendor.get(f"{API}/stats/provider").status_code == 403
    assert vendor.get(f"{API}/policies").status_code == 403
    assert vendor.post(f"{API}/organizations/{ids['orgs']['metrocare']}/test-connection").status_code == 403
    assert vendor.get(f"{API}/patients/search", params={"q": "Okafor"}).status_code == 403


def test_provider_cannot_register_apps_or_approve_as_admin(provider, ids):
    r = provider.post(f"{API}/applications", json={"name": "Sneaky", "use_case": "x x x", "requested_resource_types": ["Observation"], "purpose": "research"})
    assert r.status_code == 403
    assert provider.patch(f"{API}/applications/{ids['apps']['Trial Finder']}/status", json={"status": "suspended"}).status_code == 403


def test_vendor_sees_no_connection_details(vendor):
    orgs = vendor.get(f"{API}/organizations").json()
    assert orgs and all(o["connection"] is None for o in orgs)


def test_organization_isolation(ids):
    metro_only = login_as("provider.metrocare@demo.privexa.local")
    sunrise = ids["orgs"]["sunrise"]
    names = [o["slug"] for o in metro_only.get(f"{API}/organizations").json()]
    assert names == ["metrocare"]
    assert metro_only.get(f"{API}/organizations/{sunrise}").status_code == 403
    assert metro_only.post(f"{API}/organizations/{sunrise}/test-connection").status_code == 403
    assert metro_only.get(f"{API}/policies", params={"organization_id": sunrise}).status_code == 403
    r = metro_only.get(f"{API}/patients/search", params={"q": "Okafor"}).json()
    assert {p["organization_id"] for p in r["items"]} == {ids["orgs"]["metrocare"]}


def test_bad_login_is_rejected(anon):
    r = anon.post(f"{API}/auth/login", json={"email": "provider@demo.privexa.local", "password": "wrong"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_credentials"


# ---------- connectivity ----------


def test_both_hospitals_reachable_and_independent(provider, ids):
    for slug in ("metrocare", "sunrise"):
        r = provider.post(f"{API}/organizations/{ids['orgs'][slug]}/test-connection").json()
        assert r["ok"] is True and r["capabilities"]["fhir_version"] == "4.0.1"
    a = provider.get(f"{API}/patients/search", params={"q": "Okafor", "organization_id": ids["orgs"]["metrocare"]}).json()["items"]
    b = provider.get(f"{API}/patients/search", params={"q": "Okafor", "organization_id": ids["orgs"]["sunrise"]}).json()["items"]
    assert {p["patient_id"] for p in a} == {"a-1"}
    assert {p["patient_id"] for p in b} == {"b-1", "b-2"}
    assert {p["mrn"] for p in a}.isdisjoint({p["mrn"] for p in b})


def test_match_candidates_explain_and_rank(provider):
    items = provider.get(f"{API}/patients/matches", params={"q": "Okafor"}).json()["items"]
    top = items[0]
    assert {top["a"]["patient_id"], top["b"]["patient_id"]} == {"a-1", "b-1"} and top["confidence"] == "high"
    assert any(e["field"] == "Date of birth" for e in top["explanation"])


def test_search_rejects_injection_like_input(provider):
    assert provider.get(f"{API}/patients/search", params={"q": "x&_include=*"}).status_code == 422


# ---------- authorization of data access ----------


def test_permitted_app_gets_only_authorized_resources(admin, ids):
    link = _link(admin, ids)
    r = _request(admin, ids["apps"]["Cardio Insights"], link)
    assert r.status_code == 200, r.text
    body = r.json()
    by_org = {d["organization_id"]: d for d in body["decisions"]}
    metro, sun = by_org[ids["orgs"]["metrocare"]], by_org[ids["orgs"]["sunrise"]]
    assert metro["outcome"] == "allow" and set(metro["allowed_resource_types"]) == {"Observation", "Encounter", "Condition", "MedicationRequest"}
    # Sunrise did not grant MedicationRequest to this app.
    assert "MedicationRequest" in sun["denied_resource_types"]
    assert not any(t["resource_type"] == "MedicationRequest" and t["source_organization_id"] == ids["orgs"]["sunrise"] for t in body["timeline"])
    assert body["outcome"] == "partial"
    sources = {t["source_organization_name"] for t in body["timeline"]}
    assert sources == {"MetroCare Medical Center", "Sunrise General Hospital"}


def test_unauthorized_app_is_denied_and_audited(admin, ids):
    link = _link(admin, ids)
    r = _request(admin, ids["apps"]["Trial Finder"], link, types=("Observation",), purpose="research")
    body = r.json()
    assert body["outcome"] == "deny" and body["timeline"] == []
    for d in body["decisions"]:
        assert d["outcome"] == "deny" and "no approved access" in d["reasons"][0]
        ev = admin.get(f"{API}/audit-events/{d['audit_event_id']}").json()
        assert ev["outcome"] == "deny" and ev["action"] == "data_access"
        assert ev["request_id"] == body["request_id"]


def test_wrong_purpose_is_denied(admin, ids):
    link = _link(admin, ids)
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",), purpose="research").json()
    assert body["outcome"] == "deny"


def test_withdrawn_consent_denies_via_policy(admin, ids):
    link = _link(admin, ids)
    assert admin.patch(f"{API}/patient-links/{link}/consent", json={"consent_status": "withdrawn"}).status_code == 200
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",)).json()
    assert body["outcome"] == "deny"
    assert any("consent" in r for d in body["decisions"] for r in d["reasons"])


def test_vendor_cannot_act_for_other_vendors_app(vendor, ids):
    r = vendor.post(f"{API}/data-requests", json={"application_id": ids["apps"]["CareLoop Coordination"], "patient": {"organization_id": ids["orgs"]["metrocare"], "patient_id": "a-1"}, "resource_types": ["Encounter"], "purpose": "care_coordination"})
    assert r.status_code == 403


def test_client_credentials_flow(vendor, ids):
    created = vendor.post(f"{API}/applications", json={"name": "Vitals Lens", "use_case": "Vitals summaries", "requested_resource_types": ["Observation"], "purpose": "care_coordination"}).json()
    assert created["client_secret"].startswith("pvx_sk_dev_")
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)
    body = {"patient": {"organization_id": ids["orgs"]["metrocare"], "patient_id": "a-1"}, "resource_types": ["Observation"], "purpose": "care_coordination"}
    bad = c.post(f"{API}/data-requests", json=body, headers={"X-Client-Id": created["client_id"], "X-Client-Secret": "wrong"})
    assert bad.status_code == 401
    ok = c.post(f"{API}/data-requests", json=body, headers={"X-Client-Id": created["client_id"], "X-Client-Secret": created["client_secret"]})
    assert ok.status_code == 200 and ok.json()["outcome"] == "deny"  # registered, but no provider approval yet


def test_unconfirmed_link_cannot_be_used(admin, ids):
    r = admin.post(f"{API}/patient-links", json={"members": [{"organization_id": ids["orgs"]["metrocare"], "patient_id": "a-1"}, {"organization_id": ids["orgs"]["sunrise"], "patient_id": "b-2"}], "decision": "reject", "score": 0.4})
    link = r.json()["id"]
    assert _request(admin, ids["apps"]["Cardio Insights"], link).status_code == 409


def test_unsupported_resource_type_rejected(admin, ids):
    r = admin.post(f"{API}/data-requests", json={"application_id": ids["apps"]["Cardio Insights"], "patient": {"organization_id": ids["orgs"]["metrocare"], "patient_id": "a-1"}, "resource_types": ["Claim"], "purpose": "care_coordination"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


# ---------- failure handling ----------


def test_malformed_fhir_response_handled_gracefully(admin, ids):
    link = _link(admin, ids)
    admin.post(f"{API}/organizations/{ids['orgs']['sunrise']}/simulate", json={"mode": "malformed"})
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",)).json()
    sun_val = [v for v in body["validation"] if v["organization_id"] == ids["orgs"]["sunrise"]]
    assert sun_val and sun_val[0]["invalid"] == 1 and sun_val[0]["valid"] == 0
    assert all(t["source_organization_id"] != ids["orgs"]["sunrise"] for t in body["timeline"])
    assert any(t["source_organization_id"] == ids["orgs"]["metrocare"] for t in body["timeline"])


def test_unavailable_hospital_produces_visible_error(admin, ids):
    link = _link(admin, ids)
    admin.post(f"{API}/organizations/{ids['orgs']['sunrise']}/simulate", json={"mode": "error"})
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",)).json()
    assert body["outcome"] == "partial"
    err = [e for e in body["errors"] if e["organization_id"] == ids["orgs"]["sunrise"]][0]
    assert err["code"] == "upstream_unavailable"
    org = admin.get(f"{API}/organizations/{ids['orgs']['sunrise']}").json()
    assert org["connection"]["status"] == "down"
    jobs = admin.get(f"{API}/monitoring/jobs", params={"organization_id": ids["orgs"]["sunrise"], "status": "failure"}).json()["items"]
    assert jobs[0]["attempts"] == get_settings().fhir_max_retries + 1
    assert "password" not in str(jobs).lower() and "http://" not in str(jobs)


def test_timeout_then_recovery(admin, ids):
    sun = ids["orgs"]["sunrise"]
    admin.post(f"{API}/organizations/{sun}/simulate", json={"mode": "timeout"})
    r = admin.post(f"{API}/organizations/{sun}/test-connection").json()
    assert r["ok"] is False and r["error"]["code"] == "timeout"
    admin.post(f"{API}/organizations/{sun}/simulate", json={"mode": "none"})
    r = admin.post(f"{API}/organizations/{sun}/test-connection").json()
    assert r["ok"] is True and r["status"] == "healthy"


def test_retry_recovers_flaky_endpoint(admin, ids):
    sun = ids["orgs"]["sunrise"]
    admin.post(f"{API}/organizations/{sun}/simulate", json={"mode": "flaky"})
    r = admin.post(f"{API}/organizations/{sun}/test-connection").json()
    assert r["ok"] is True and r["status"] == "degraded"
    job = admin.get(f"{API}/monitoring/jobs", params={"organization_id": sun}).json()["items"][0]
    assert [a["outcome"] for a in job["attempt_log"]] == ["timeout", "success"]


# ---------- audit & anchoring ----------


def test_audit_events_link_to_request_ids(admin, ids):
    link = _link(admin, ids)
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",)).json()
    evs = admin.get(f"{API}/audit-events", params={"request_id": body["request_id"]}).json()["items"]
    assert len(evs) == 2 and all(e["request_id"] == body["request_id"] for e in evs)
    jobs = admin.get(f"{API}/monitoring/jobs").json()["items"]
    assert any(j["request_id"] == body["request_id"] for j in jobs)


def test_anchor_status_reflects_unreachable_chain(admin, ids, monkeypatch):
    from app.modules.blockchain import process_pending, reset_client

    monkeypatch.setattr(get_settings(), "chain_rpc_url", "http://127.0.0.1:9")
    reset_client()
    link = _link(admin, ids)
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",)).json()
    ev = admin.get(f"{API}/audit-events/{body['decisions'][0]['audit_event_id']}").json()
    assert ev["anchor_status"] == "pending"  # honest: not yet submitted
    process_pending()
    reset_client()
    ev = admin.get(f"{API}/audit-events/{body['decisions'][0]['audit_event_id']}").json()
    assert ev["anchor_status"] == "failed" and ev["anchor_tx_hash"] is None
    v = admin.post(f"{API}/audit-events/{ev['id']}/verify").json()
    assert v["status"] == "not_anchored"  # never reported as verified


def test_provider_sees_only_own_org_audit(ids, admin):
    link = _link(admin, ids)
    _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",))
    metro_only = login_as("provider.metrocare@demo.privexa.local")
    items = metro_only.get(f"{API}/audit-events", params={"action": "data_access"}).json()["items"]
    assert items and all(e["organization_id"] == ids["orgs"]["metrocare"] for e in items)


def test_tamper_endpoint_admin_only(provider, ids, admin):
    link = _link(admin, ids)
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",)).json()
    eid = body["decisions"][0]["audit_event_id"]
    assert provider.post(f"{API}/audit-events/{eid}/demo-tamper", json={}).status_code == 403
    assert admin.post(f"{API}/audit-events/{eid}/demo-tamper", json={}).json()["tampered"] is True
    db = SessionLocal()
    from app.modules.audit import compute_fingerprint

    ev = db.get(AuditEvent, eid)
    assert compute_fingerprint(ev) != ev.fingerprint


# ---------- access requests & policies ----------


def test_access_request_lifecycle(vendor, provider, ids):
    app_id = vendor.post(f"{API}/applications", json={"name": "Lab Watch", "use_case": "Lab trend alerts", "requested_resource_types": ["Observation"], "purpose": "care_coordination"}).json()["id"]
    req = vendor.post(f"{API}/access-requests", json={"application_id": app_id, "organization_id": ids["orgs"]["sunrise"], "resource_types": ["Observation"], "purpose": "care_coordination", "submit": False}).json()
    assert req["status"] == "draft"
    assert provider.get(f"{API}/access-requests", params={"status": "draft"}).json()["total"] == 0  # drafts are private
    assert vendor.post(f"{API}/access-requests/{req['id']}/submit").json()["status"] == "submitted"
    assert vendor.post(f"{API}/access-requests/{req['id']}/review", json={"action": "approve"}).status_code == 403
    assert provider.post(f"{API}/access-requests/{req['id']}/review", json={"action": "reject"}).status_code == 422
    assert provider.post(f"{API}/access-requests/{req['id']}/review", json={"action": "start_review"}).json()["status"] == "under_review"
    assert provider.post(f"{API}/access-requests/{req['id']}/review", json={"action": "approve"}).json()["status"] == "approved"
    r = vendor.post(f"{API}/data-requests", json={"application_id": app_id, "patient": {"organization_id": ids["orgs"]["sunrise"], "patient_id": "b-1"}, "resource_types": ["Observation"], "purpose": "care_coordination"}).json()
    assert r["outcome"] == "allow" and len(r["timeline"]) == 1
    assert provider.post(f"{API}/access-requests/{req['id']}/review", json={"action": "revoke", "reason": "Demo complete"}).json()["status"] == "revoked"
    r = vendor.post(f"{API}/data-requests", json={"application_id": app_id, "patient": {"organization_id": ids["orgs"]["sunrise"], "patient_id": "b-1"}, "resource_types": ["Observation"], "purpose": "care_coordination"}).json()
    assert r["outcome"] == "deny"


def test_policy_toggle_versions_and_logs(provider, ids):
    pols = provider.get(f"{API}/policies", params={"organization_id": ids["orgs"]["sunrise"]}).json()
    allergy = [p for p in pols if p["name"] == "Restrict allergy data"][0]
    updated = provider.patch(f"{API}/policies/{allergy['id']}", json={"enabled": True}).json()
    assert updated["version"] == 2 and updated["enabled"] is True
    assert len(provider.get(f"{API}/policies/{allergy['id']}/versions").json()) == 2
    logs = provider.get(f"{API}/audit-events", params={"action": "policy_updated"}).json()["items"]
    assert logs and "v2" in logs[0]["reason"]


def test_policy_dry_run(provider, ids):
    d = provider.post(f"{API}/policies/evaluate", json={"organization_id": ids["orgs"]["metrocare"], "application_id": ids["apps"]["Cardio Insights"], "resource_types": ["Observation"], "purpose": "care_coordination", "consent_status": "withdrawn"}).json()
    assert d["outcome"] == "deny" and any(p["matched"] for p in d["policy_results"])


# ---------- public ----------


def test_contact_stores_and_reports_honestly(anon):
    r = anon.post(f"{API}/contact", json={"inquiry_type": "provider", "name": "Test", "email": "t@example.org", "organization": "Org", "message": "Hello there, testing."})
    body = r.json()
    assert r.status_code == 201 and body["stored"] is True and body["delivered"] is False and body["delivery"] == "none"
    assert "sent" not in body["message"].lower()


def test_contact_validation(anon):
    r = anon.post(f"{API}/contact", json={"inquiry_type": "provider", "name": "", "email": "nope", "organization": "Org", "message": "short"})
    assert r.status_code == 422
    fields = {d["field"] for d in r.json()["error"]["details"]}
    assert {"name", "email", "message"} <= fields


def test_directory_is_public_and_labeled(anon):
    d = anon.get(f"{API}/public/directory").json()
    assert len(d["systems"]) == 2 and all(s["simulated"] for s in d["systems"])
    assert all("base_url" not in s and "url" not in str(s).lower() for s in d["systems"])


def test_errors_are_structured_with_request_id(anon):
    r = anon.get(f"{API}/nope")
    assert r.status_code == 404 and r.json()["error"]["request_id"] == r.headers["X-Request-ID"]


@pytest.mark.parametrize("role", ["provider_admin", "vendor_dev", "demo_admin"])
def test_demo_login_roles(anon, role):
    assert anon.post(f"{API}/auth/demo-login", json={"role": role}).json()["role"] == role


@pytest.mark.live
def test_anchor_and_verify_on_live_chain(admin, ids):
    """Requires the local demo chain (python scripts/dev.py). Skips when it is not running."""
    from app.modules.blockchain import ChainUnavailable, get_client, process_pending, reset_client

    reset_client()
    try:
        get_client()
    except ChainUnavailable:
        pytest.skip("demo chain not running")
    link = _link(admin, ids)
    body = _request(admin, ids["apps"]["Cardio Insights"], link, types=("Observation",)).json()
    eid = body["decisions"][0]["audit_event_id"]
    process_pending()
    ev = admin.get(f"{API}/audit-events/{eid}").json()
    assert ev["anchor_status"] == "anchored" and ev["anchor_tx_hash"] and ev["anchor_block"]
    assert admin.post(f"{API}/audit-events/{eid}/verify").json()["status"] == "verified"
    admin.post(f"{API}/audit-events/{eid}/demo-tamper", json={})
    assert admin.post(f"{API}/audit-events/{eid}/verify").json()["status"] == "mismatch"
    admin.post(f"{API}/audit-events/{eid}/demo-tamper", json={"restore": True})
    assert admin.post(f"{API}/audit-events/{eid}/verify").json()["status"] == "verified"


@pytest.mark.live
def test_live_hospitals_are_independent():
    """Requires both FHIR simulators (python scripts/dev.py). Skips when they are not running."""
    import httpx

    try:
        a = httpx.get("http://127.0.0.1:8081/fhir/Patient", params={"name": "Krishnan"}, timeout=3).json()
        b = httpx.get("http://127.0.0.1:8082/fhir/Patient", params={"name": "Krishnan"}, timeout=3).json()
    except httpx.HTTPError:
        pytest.skip("hospital simulators not running")
    a_mrns = {e["resource"]["identifier"][0]["value"] for e in a["entry"]}
    b_mrns = {e["resource"]["identifier"][0]["value"] for e in b["entry"]}
    assert a["total"] == 1 and b["total"] == 2
    assert a_mrns.isdisjoint(b_mrns)
