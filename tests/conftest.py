"""Shared fixtures: an isolated SQLite database, seeded demo data and an in-memory mock of both hospitals.

The mock FHIR servers serve small synthetic fixtures through httpx.MockTransport, so no real clinical
data or running services are needed. Tests marked `live` use the real Docker services instead.
"""

import os
import re
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="privexa-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'test.db'}"
os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("CHAIN_RPC_URL", "http://127.0.0.1:8545")
os.environ.setdefault("FHIR_MAX_RETRIES", "2")
os.environ["ANCHOR_WORKER"] = "false"  # tests drive anchoring explicitly via process_pending()

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Organization  # noqa: E402
from app.modules import connectors  # noqa: E402
from app.modules.auth import login_limiter  # noqa: E402
from app.modules.data_requests import data_limiter  # noqa: E402
from app.modules.public import contact_limiter  # noqa: E402
from app.seed import seed  # noqa: E402


def _patient(pid, given, family, birth, gender, phone, mrn, city="Springfield"):
    return {
        "resourceType": "Patient",
        "id": pid,
        "identifier": [{"type": {"coding": [{"code": "MR"}]}, "system": "urn:test:mrn", "value": mrn}],
        "name": [{"family": family, "given": given}],
        "birthDate": birth,
        "gender": gender,
        "telecom": [{"system": "phone", "value": phone}],
        "address": [{"city": city, "postalCode": "01101"}],
    }


def _obs(oid, pid, text, value, unit, date):
    return {"resourceType": "Observation", "id": oid, "status": "final", "code": {"text": text}, "subject": {"reference": f"Patient/{pid}"}, "effectiveDateTime": date, "valueQuantity": {"value": value, "unit": unit}}


def _enc(eid, pid, date):
    return {"resourceType": "Encounter", "id": eid, "status": "finished", "class": {"code": "AMB"}, "type": [{"text": "General examination"}], "subject": {"reference": f"Patient/{pid}"}, "period": {"start": date}}


def _cond(cid, pid, text, date):
    return {"resourceType": "Condition", "id": cid, "code": {"text": text}, "subject": {"reference": f"Patient/{pid}"}, "onsetDateTime": date, "clinicalStatus": {"text": "active"}}


def _med(mid, pid, text, date):
    return {"resourceType": "MedicationRequest", "id": mid, "status": "active", "intent": "order", "medicationCodeableConcept": {"text": text}, "subject": {"reference": f"Patient/{pid}"}, "authoredOn": date}


HOSPITALS = {
    "metrocare": [
        _patient("a-1", ["Amara"], "Okafor", "1975-03-14", "female", "555-201-0142", "MC-100200"),
        _patient("a-2", ["Liam"], "Chen", "1960-07-01", "male", "555-201-9999", "MC-100237"),
        _obs("a-obs-1", "a-1", "Heart rate", 72, "/min", "2026-09-02T10:00:00Z"),
        _obs("a-obs-2", "a-1", "Systolic blood pressure", 128, "mm[Hg]", "2026-09-02T10:00:00Z"),
        _enc("a-enc-1", "a-1", "2026-09-02T09:30:00Z"),
        _cond("a-cond-1", "a-1", "Essential hypertension", "2024-01-10"),
        _med("a-med-1", "a-1", "Lisinopril 10 MG Oral Tablet", "2024-01-10"),
        _obs("a-obs-9", "a-2", "Heart rate", 80, "/min", "2026-08-01T10:00:00Z"),
    ],
    "sunrise": [
        _patient("b-1", ["Amara", "N."], "Okafor", "1975-03-14", "female", "(555) 201-0142", "SG-100200", city="Riverton"),
        _patient("b-2", ["Amaka"], "Okafor", "1982-03-14", "female", "555-201-7731", "SG-100237", city="Riverton"),
        _obs("b-obs-1", "b-1", "Body weight", 68.2, "kg", "2026-10-01T08:00:00Z"),
        _enc("b-enc-1", "b-1", "2026-10-01T08:00:00Z"),
        _cond("b-cond-1", "b-1", "Prediabetes", "2025-05-05"),
        _med("b-med-1", "b-1", "Metformin 500 MG", "2025-05-05"),
    ],
}


def fhir_handler(slug: str):
    data = HOSPITALS[slug]

    def handle(request: httpx.Request) -> httpx.Response:
        path = request.url.path.split("/fhir", 1)[-1].strip("/")
        if path == "metadata":
            return httpx.Response(200, json={"resourceType": "CapabilityStatement", "fhirVersion": "4.0.1", "software": {"name": f"Mock {slug}"}, "rest": [{"resource": [{"type": t} for t in sorted({r['resourceType'] for r in data})]}]})
        rtype = path
        p = request.url.params
        items = [r for r in data if r["resourceType"] == rtype]
        if rtype == "Patient" and p.get("name"):
            q = p["name"].lower()
            items = [r for r in items if any(q in (n.get("family", "") + " " + " ".join(n.get("given", []))).lower() for n in r["name"])]
        if rtype == "Patient" and p.get("birthdate"):
            items = [r for r in items if r.get("birthDate") == p["birthdate"]]
        if p.get("patient"):
            items = [r for r in items if re.sub("^Patient/", "", (r.get("subject") or r.get("patient") or {}).get("reference", "")) == p["patient"]]
        return httpx.Response(200, json={"resourceType": "Bundle", "type": "searchset", "total": len(items), "entry": [{"resource": r} for r in items]})

    return handle


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = SessionLocal()
    seed(db)
    db.close()
    connectors.transport_overrides.clear()
    connectors.transport_overrides["metrocare"] = httpx.MockTransport(fhir_handler("metrocare"))
    connectors.transport_overrides["sunrise"] = httpx.MockTransport(fhir_handler("sunrise"))
    for lim in (login_limiter, data_limiter, contact_limiter):
        lim.reset()
    yield
    connectors.transport_overrides.clear()


def _client(role: str | None) -> TestClient:
    c = TestClient(app)
    if role:
        r = c.post("/api/v1/auth/demo-login", json={"role": role})
        assert r.status_code == 200, r.text
        c.headers["X-CSRF-Token"] = c.cookies.get("privexa_csrf")
    return c


@pytest.fixture
def anon():
    return _client(None)


@pytest.fixture
def provider():
    return _client("provider_admin")


@pytest.fixture
def vendor():
    return _client("vendor_dev")


@pytest.fixture
def admin():
    return _client("demo_admin")


@pytest.fixture
def ids():
    db = SessionLocal()
    from sqlalchemy import select

    from app.models import Application

    orgs = {o.slug: o.id for o in db.scalars(select(Organization))}
    apps = {a.name: a.id for a in db.scalars(select(Application))}
    db.close()
    return {"orgs": orgs, "apps": apps}


def login_as(email: str) -> TestClient:
    c = TestClient(app)
    r = c.post("/api/v1/auth/login", json={"email": email, "password": os.environ.get("DEMO_PASSWORD", "privexa-demo")})
    assert r.status_code == 200, r.text
    c.headers["X-CSRF-Token"] = c.cookies.get("privexa_csrf")
    return c
