# Technical decisions

Decisions that differ from, or refine, the original product specification — and why.

## No Docker
The project owner asked for the platform to run without Docker. Every component therefore runs as a
native process started by `scripts/dev.py`:

| Spec suggestion | What runs instead | Why |
|---|---|---|
| Two HAPI FHIR JPA servers | `simulator/fhir_server.py`, started twice (ports 8081/8082), each with its own SQLite database | HAPI requires Java, which is not part of the local toolchain. The simulator implements the FHIR R4 REST subset Privexa uses (CapabilityStatement, search, read, update, transaction bundles) and serves standard R4 JSON. Privexa's connector talks to it exactly as it would to any FHIR R4 server, so a HAPI or vendor server can be swapped in by changing `HOSPITAL_A_FHIR_URL` / `HOSPITAL_B_FHIR_URL`. |
| Synthea | `simulator/seed.py`, a deterministic synthetic-record generator | Synthea also requires Java. The generator produces R4 resources with real terminology (LOINC, SNOMED CT, RxNorm, CVX), stable IDs and PUT-based transactions, so reseeding is idempotent. |
| PostgreSQL | SQLite (WAL mode) by default | Zero-install. The data layer is SQLAlchemy + Alembic; set `DATABASE_URL=postgresql+psycopg://…` to use PostgreSQL (driver included). |
| Hardhat local chain | Hardhat node via `npx` | Unchanged — Hardhat runs natively on Node.js. |

## SQLite on Windows
Rollback-journal mode created and synced a journal file on every commit; with real-time file scanning
this made commits take seconds and occasionally fail with `disk I/O error`. Both the API database and the
simulators use `journal_mode=WAL`, `synchronous=NORMAL` and a busy timeout. Simulator transactions are
written in a single commit.

## Blockchain anchoring
* Anchoring runs in a single background worker thread in the API (`AnchorWorker`). One writer avoids
  nonce races; every pending audit event is picked up, whatever created it.
* Importing `web3` and connecting can take tens of seconds on a cold start (notably on Windows), so the
  worker warms the client at startup and reuses it.
* The contract stores only 32-byte SHA-256 fingerprints of approved, non-clinical audit metadata
  (see `FINGERPRINT_FIELDS` in `apps/api/app/modules/audit.py`). Patient references kept for audit
  live in the event's `details`, which are never part of the fingerprint and never go on-chain.
* The Hardhat node is in-memory. After a restart, earlier anchors no longer exist on the new chain and
  verification honestly reports that the fingerprint was not found.

## Failure simulation
Outages are injected at the HTTP transport layer of Privexa's connector (`FaultTransport`). The real
timeout, retry, validation and monitoring code runs; only the hospital's misbehaviour is simulated.
Modes: `timeout`, `error` (HTTP 503), `malformed` (invalid FHIR), `flaky` (fails once, recovers on retry).

## Patient matching
Deterministic, explainable weighted scoring over family name, given name, birth date, sex, phone and
location. Local MRNs are never used for matching because each hospital assigns its own. A match is only
a suggestion: an authorized reviewer must confirm it before it can be used in a data request.

## Policy evaluation order
Default deny. 1) application active → 2) approved access request (grant) for that organization →
3) stated purpose equals the granted purpose → 4) each resource type inside the granted scope →
5) each enabled organization policy (deny rules, consent requirement). Evaluated independently per
organization; only allowed resource types are ever requested from a hospital.
