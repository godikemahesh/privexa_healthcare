"""A small HL7 FHIR R4 server used to simulate a hospital system in the Privexa demo.

Each hospital runs as its own process with its own SQLite database:

    python simulator/fhir_server.py --name "MetroCare Medical Center" --port 8081 --db simulator/data/metrocare.db
    python simulator/fhir_server.py --name "Sunrise General Hospital" --port 8082 --db simulator/data/sunrise.db

Supported (subset of the FHIR R4 RESTful API):
  GET  /fhir/metadata                      CapabilityStatement
  GET  /fhir/{type}?params                 search -> searchset Bundle
  GET  /fhir/{type}/{id}                   read
  PUT  /fhir/{type}/{id}                   create-or-update (idempotent)
  POST /fhir                               transaction Bundle of PUT entries

Search parameters: _count, _offset, _summary=count, _sort; Patient: name, family, given, birthdate,
gender, identifier; clinical resources: patient / subject.
Everything served is synthetic demonstration data.
"""

import argparse
import json
import re
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

RESOURCE_TYPES = ["Patient", "Encounter", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "Procedure", "DiagnosticReport"]
FHIR_JSON = "application/fhir+json"
_ID = re.compile(r"^[A-Za-z0-9\-.]{1,64}$")


def outcome(status: int, code: str, text: str) -> JSONResponse:
    return JSONResponse({"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": code, "diagnostics": text}]}, status_code=status, media_type=FHIR_JSON)


def _patient_ref(res: dict) -> str | None:
    for key in ("subject", "patient"):
        ref = (res.get(key) or {}).get("reference") if isinstance(res.get(key), dict) else None
        if isinstance(ref, str) and ref.startswith("Patient/"):
            return ref.split("/", 1)[1]
    return None


def _sort_date(res: dict) -> str:
    for key in ("effectiveDateTime", "onsetDateTime", "authoredOn", "occurrenceDateTime", "performedDateTime", "recordedDate", "issued", "birthDate"):
        if isinstance(res.get(key), str):
            return res[key]
    for key in ("period", "effectivePeriod", "performedPeriod"):
        if isinstance(res.get(key), dict) and isinstance(res[key].get("start"), str):
            return res[key]["start"]
    return ""


def _search_text(res: dict) -> str:
    if res.get("resourceType") != "Patient":
        return ""
    parts = []
    for n in res.get("name") or []:
        parts.append(n.get("family") or "")
        parts.extend(n.get("given") or [])
    return " ".join(parts).lower()


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.Lock()
        with self.lock:
            self.conn.execute("PRAGMA journal_mode=WAL")
            self.conn.execute("PRAGMA synchronous=NORMAL")
            self.conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS resources (
                  type TEXT NOT NULL, id TEXT NOT NULL, patient_id TEXT, sort_date TEXT, search_text TEXT,
                  version INTEGER NOT NULL DEFAULT 1, last_updated TEXT NOT NULL, body TEXT NOT NULL,
                  PRIMARY KEY (type, id));
                CREATE INDEX IF NOT EXISTS ix_patient ON resources(type, patient_id);
                """
            )

    def put(self, res: dict) -> tuple[dict, bool]:
        now = datetime.now(timezone.utc).isoformat()
        with self.lock:
            row = self.conn.execute("SELECT version, body FROM resources WHERE type=? AND id=?", (res["resourceType"], res["id"])).fetchone()
            body = {k: v for k, v in res.items() if k != "meta"}
            if row and json.loads(row[1]) == body:
                stored = json.loads(row[1])
                stored["meta"] = {"versionId": str(row[0])}
                return stored, False  # unchanged: idempotent re-seed does not bump versions
            version = (row[0] + 1) if row else 1
            res = {**body, "meta": {"versionId": str(version), "lastUpdated": now}}
            self.conn.execute(
                "INSERT OR REPLACE INTO resources(type,id,patient_id,sort_date,search_text,version,last_updated,body) VALUES (?,?,?,?,?,?,?,?)",
                (res["resourceType"], res["id"], _patient_ref(res), _sort_date(res), _search_text(res), version, now, json.dumps(body)),
            )
            self.conn.commit()
        return res, row is None

    def put_many(self, resources: list[dict]) -> list[tuple[dict, bool]]:
        """Write a whole transaction in one commit (all-or-nothing)."""
        now = datetime.now(timezone.utc).isoformat()
        out = []
        with self.lock:
            try:
                for res in resources:
                    row = self.conn.execute("SELECT version, body FROM resources WHERE type=? AND id=?", (res["resourceType"], res["id"])).fetchone()
                    body = {k: v for k, v in res.items() if k != "meta"}
                    if row and json.loads(row[1]) == body:
                        out.append(({**body, "meta": {"versionId": str(row[0])}}, False))
                        continue
                    version = (row[0] + 1) if row else 1
                    self.conn.execute(
                        "INSERT OR REPLACE INTO resources(type,id,patient_id,sort_date,search_text,version,last_updated,body) VALUES (?,?,?,?,?,?,?,?)",
                        (body["resourceType"], body["id"], _patient_ref(body), _sort_date(body), _search_text(body), version, now, json.dumps(body)),
                    )
                    out.append(({**body, "meta": {"versionId": str(version), "lastUpdated": now}}, row is None))
                self.conn.commit()
            except Exception:
                self.conn.rollback()
                raise
        return out

    def get(self, rtype: str, rid: str) -> dict | None:
        with self.lock:
            row = self.conn.execute("SELECT body, version, last_updated FROM resources WHERE type=? AND id=?", (rtype, rid)).fetchone()
        if not row:
            return None
        return {**json.loads(row[0]), "meta": {"versionId": str(row[1]), "lastUpdated": row[2]}}

    def search(self, rtype: str, where: list[str], args: list, order: str, limit: int, offset: int) -> tuple[int, list[dict]]:
        clause = " AND ".join(["type=?"] + where)
        with self.lock:
            total = self.conn.execute(f"SELECT COUNT(*) FROM resources WHERE {clause}", [rtype, *args]).fetchone()[0]
            rows = self.conn.execute(f"SELECT body, version, last_updated FROM resources WHERE {clause} ORDER BY {order} LIMIT ? OFFSET ?", [rtype, *args, limit, offset]).fetchall()
        return total, [{**json.loads(b), "meta": {"versionId": str(v), "lastUpdated": u}} for b, v, u in rows]


def create_app(name: str, store: Store) -> FastAPI:
    app = FastAPI(title=f"{name} — simulated FHIR R4 server", docs_url=None, redoc_url=None, openapi_url=None)

    def fhir(data: dict, status: int = 200) -> JSONResponse:
        return JSONResponse(data, status_code=status, media_type=FHIR_JSON)

    @app.get("/fhir/metadata")
    def metadata():
        return fhir(
            {
                "resourceType": "CapabilityStatement",
                "status": "active",
                "date": datetime.now(timezone.utc).date().isoformat(),
                "kind": "instance",
                "software": {"name": "Privexa FHIR simulator", "version": "0.1.0"},
                "implementation": {"description": f"{name} (fictional, simulated)"},
                "fhirVersion": "4.0.1",
                "format": ["application/fhir+json"],
                "rest": [
                    {
                        "mode": "server",
                        "resource": [
                            {
                                "type": t,
                                "interaction": [{"code": "read"}, {"code": "search-type"}, {"code": "update"}],
                                "searchParam": (
                                    [{"name": n, "type": ty} for n, ty in (("name", "string"), ("family", "string"), ("given", "string"), ("birthdate", "date"), ("gender", "token"), ("identifier", "token"))]
                                    if t == "Patient"
                                    else [{"name": "patient", "type": "reference"}, {"name": "subject", "type": "reference"}]
                                ),
                            }
                            for t in RESOURCE_TYPES
                        ],
                        "interaction": [{"code": "transaction"}],
                    }
                ],
            }
        )

    @app.get("/fhir/{rtype}")
    def search(rtype: str, request: Request):
        if rtype not in RESOURCE_TYPES:
            return outcome(404, "not-supported", f"Resource type {rtype} is not supported")
        p = request.query_params
        where, args = [], []
        try:
            count = min(max(int(p.get("_count", 50)), 0), 500)
            offset = max(int(p.get("_offset", 0)), 0)
        except ValueError:
            return outcome(400, "invalid", "_count and _offset must be integers")
        if rtype == "Patient":
            for key in ("name", "family", "given"):
                if p.get(key):
                    for term in p[key].lower().split():
                        where.append("search_text LIKE ?")
                        args.append(f"%{term}%")
            if p.get("birthdate"):
                where.append("json_extract(body,'$.birthDate') = ?")
                args.append(p["birthdate"].removeprefix("eq"))
            if p.get("gender"):
                where.append("json_extract(body,'$.gender') = ?")
                args.append(p["gender"])
            if p.get("identifier"):
                value = p["identifier"].split("|")[-1]
                where.append("EXISTS (SELECT 1 FROM json_each(body,'$.identifier') WHERE json_extract(value,'$.value') = ?)")
                args.append(value)
            order = "json_extract(body,'$.name[0].family'), id" if p.get("_sort", "").lstrip("-") == "family" else "id"
        else:
            ref = p.get("patient") or p.get("subject")
            if ref:
                where.append("patient_id = ?")
                args.append(ref.split("/")[-1])
            order = "sort_date ASC, id" if p.get("_sort") == "date" else "sort_date DESC, id"
        total, items = store.search(rtype, where, args, order, 0 if p.get("_summary") == "count" else count, offset)
        base = str(request.base_url).rstrip("/")
        bundle = {"resourceType": "Bundle", "type": "searchset", "total": total}
        if p.get("_summary") != "count":
            bundle["entry"] = [{"fullUrl": f"{base}/fhir/{rtype}/{r['id']}", "resource": r, "search": {"mode": "match"}} for r in items]
            if offset + count < total:
                q = dict(p)
                q["_offset"] = str(offset + count)
                bundle["link"] = [{"relation": "next", "url": f"{base}/fhir/{rtype}?" + "&".join(f"{k}={v}" for k, v in q.items())}]
        return fhir(bundle)

    @app.get("/fhir/{rtype}/{rid}")
    def read(rtype: str, rid: str):
        if rtype not in RESOURCE_TYPES:
            return outcome(404, "not-supported", f"Resource type {rtype} is not supported")
        res = store.get(rtype, rid)
        return fhir(res) if res else outcome(404, "not-found", f"{rtype}/{rid} not found")

    def _validate_put(rtype: str, rid: str, res) -> str | None:
        if rtype not in RESOURCE_TYPES:
            return f"Resource type {rtype} is not supported"
        if not isinstance(res, dict) or res.get("resourceType") != rtype:
            return "resourceType does not match the URL"
        if res.get("id") != rid or not _ID.match(rid):
            return "Resource id is missing, invalid or does not match the URL"
        return None

    @app.put("/fhir/{rtype}/{rid}")
    async def update(rtype: str, rid: str, request: Request):
        try:
            res = await request.json()
        except ValueError:
            return outcome(400, "invalid", "Body is not valid JSON")
        err = _validate_put(rtype, rid, res)
        if err:
            return outcome(400, "invalid", err)
        stored, created = store.put(res)
        return fhir(stored, 201 if created else 200)

    @app.post("/fhir")
    @app.post("/fhir/", include_in_schema=False)
    async def transaction(request: Request):
        try:
            bundle = await request.json()
        except ValueError:
            return outcome(400, "invalid", "Body is not valid JSON")
        if not isinstance(bundle, dict) or bundle.get("resourceType") != "Bundle" or bundle.get("type") != "transaction":
            return outcome(400, "invalid", "Expected a transaction Bundle")
        entries = bundle.get("entry") or []
        for e in entries:  # validate everything before writing anything
            req = e.get("request") or {}
            parts = str(req.get("url", "")).split("/")
            if req.get("method") != "PUT" or len(parts) != 2:
                return outcome(400, "not-supported", "Only PUT Type/id entries are supported in transactions")
            err = _validate_put(parts[0], parts[1], e.get("resource"))
            if err:
                return outcome(400, "invalid", f"{req.get('url')}: {err}")
        out = []
        for stored, created in store.put_many([e["resource"] for e in entries]):
            out.append({"response": {"status": "201 Created" if created else "200 OK", "location": f"{stored['resourceType']}/{stored['id']}/_history/{stored['meta']['versionId']}"}})
        return fhir({"resourceType": "Bundle", "type": "transaction-response", "entry": out})

    return app


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True)
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--db", required=True)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    uvicorn.run(create_app(a.name, Store(Path(a.db))), host=a.host, port=a.port, log_level="warning")


if __name__ == "__main__":
    main()
