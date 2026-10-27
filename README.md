# Privexa

**Private Next Gen AI** — healthcare connectivity for a more trusted, connected future.

Privexa helps healthcare providers and technology companies connect existing healthcare systems with
authorized applications through standardized integrations, controlled data access and auditable workflows.

This repository contains:

- **Public website** — mission, solutions, products, integrations directory, security approach, contact.
- **Privexa for Providers** (`/app/provider`) — connected systems, applications, access requests, policies,
  patient matching, audit trail, integration health.
- **Privexa for Vendors** (`/app/vendor`) — application registration, integration directory, API Explorer,
  sandbox, access requests, audit activity and documentation (Privexa Studio).
- **Guided interactive demo** (`/demo/workspace`) — a narrated 15-step walkthrough on real services.
- **Working backend** — FastAPI with FHIR connectors, a policy engine, audit events and blockchain anchoring.
- **Two independent hospital simulators** — FHIR R4 servers with synthetic patient records.
- **AuditAnchor smart contract** — Solidity on a local Hardhat chain.

> **Demonstration only.** MetroCare Medical Center and Sunrise General Hospital are fictional. All patient
> data is synthetic. Approvals in the demo are made by a demo administrator, not real hospitals. The
> blockchain is a local development network. Nothing here is a claim of certification, regulatory approval,
> or production deployment.

---

## Quick start (no Docker)

Requirements: **Python 3.10+**, **Node.js 20+**, and Google Chrome (only for end-to-end tests).

```bash
python scripts/setup.py    # once: Python venv, npm installs, contract compile, .env
python scripts/dev.py      # starts everything; Ctrl+C stops everything
```

Then open **http://localhost:5173**.

`scripts/dev.py` starts, in order:

| Service | Address |
|---|---|
| Hospital A simulator — MetroCare Medical Center (fictional) | http://127.0.0.1:8081/fhir |
| Hospital B simulator — Sunrise General Hospital (fictional) | http://127.0.0.1:8082/fhir |
| Demo blockchain (Hardhat) + AuditAnchor deployment | http://127.0.0.1:8545 |
| Privexa API (migrations and demo seed run first) | http://127.0.0.1:8000 · docs at `/api/v1/docs` |
| Web app | http://localhost:5173 |

It also loads the synthetic patients into both hospitals. Services already running are reused.
Rerunning is safe: seeding is idempotent.

### Running pieces individually
```bash
# hospitals
apps/api/.venv/Scripts/python simulator/fhir_server.py --name "MetroCare Medical Center" --port 8081 --db simulator/data/metrocare.db
apps/api/.venv/Scripts/python simulator/fhir_server.py --name "Sunrise General Hospital" --port 8082 --db simulator/data/sunrise.db
apps/api/.venv/Scripts/python simulator/seed.py          # load synthetic data (idempotent)

# chain + contract
cd contracts && npx hardhat node                         # terminal 1
cd contracts && npm run deploy:local                     # writes contracts/deployments/localhost.json

# API
cd apps/api && .venv/Scripts/python -m alembic upgrade head && .venv/Scripts/python -m app.seed
cd apps/api && .venv/Scripts/python -m uvicorn app.main:app --port 8000

# web
cd apps/web && npm run dev
```
(On macOS/Linux use `.venv/bin/python`.)

---

## Using the demo

### Guided walkthrough
Go to **/demo** → **Launch Interactive Demo**. Each step explains what is happening and why it matters,
then runs it for real:

1. Two independent hospitals · 2. Test both connections · 3. Search for a patient · 4. Same person,
separate records (different MRNs) · 5. A suggested match, with its explanation and a near-miss ·
6. A person confirms the match · 7. An application asks for data · 8. Privexa checks every rule ·
9. Only permitted data returns · 10. One timeline with source attribution · 11. The access is recorded ·
12. Anchored on the blockchain · 13. Verify integrity (and try tampering) · 14. A denied request ·
15. An outage, then recovery.

### Provider demo
Sign in → **Provider** (or `provider@demo.privexa.local` / `privexa-demo`). Try:
- **Connected Systems** → *Test connection*, *View capabilities*, *Simulate failure* (timeout, 503,
  malformed FHIR, intermittent).
- **Access Requests** → review *Trial Finder*'s pending request: start review, approve or reject.
- **Policies** → toggle *Restrict allergy data*, check its version history, run *Test a policy*.
- **Patient Matching** → search `Krishnan`, review candidates, withdraw demo consent.
- **Audit Trail** → filter, open an event, **Verify integrity**.
- **Integration Health** → latency, failures, retries and per-attempt history.

To see organization isolation, sign in as `provider.metrocare@demo.privexa.local`: it only sees MetroCare.

### Vendor demo
Sign in → **Vendor** (`vendor@demo.privexa.local`). Try:
- **My Applications** → register an application; the development secret is shown once.
- **Access Requests** → request access to a hospital (a demo admin approves it).
- **Sandbox** → pick an application, the synthetic patient *Ananya Krishnan (both hospitals)*, resource
  types and purpose → inspect the decision, FHIR validation, timeline and audit anchor.
- **API Explorer / Documentation** → generated from the live OpenAPI contract, with Python and
  JavaScript examples.

### Blockchain demonstration
Every data access, denial, policy change and review creates an audit event. A background worker
computes a SHA-256 fingerprint of approved, non-clinical metadata and anchors it with
`AuditAnchor.anchor(bytes32)`. The UI shows *pending* until the receipt arrives, then the block and
transaction hash. **Verify integrity** recomputes the fingerprint from the database and checks it against
the chain. As demo admin, **Simulate tampering** alters the stored record so verification reports a
mismatch; **Restore record** undoes it.

The Hardhat node is in-memory. After a restart, `scripts/dev.py` redeploys the contract, and older
anchors honestly verify as "not found on the current chain".

---

## Tests

```bash
python scripts/test.py          # backend (pytest), contract (Hardhat), web components (Vitest)
python scripts/test.py --e2e    # + Playwright end-to-end tests (run scripts/dev.py first)
```

| Suite | Covers |
|---|---|
| `tests/unit` | FHIR validation and normalization, explainable matching, audit fingerprints |
| `tests/integration` | API, role and organization isolation, CSRF, allowed/denied/partial requests, consent policies, malformed FHIR, outages, retry and recovery, request-ID linkage, anchor status, tamper detection, contact honesty |
| `tests/integration` (`live`) | Real anchoring and verification on the running chain; both hospitals independent (skip when services are down) |
| `contracts/test` | Anchoring, events, duplicate and zero-fingerprint rejection, owner-only access |
| `apps/web/src/__tests__` | Status labels, match review card, decision card |
| `tests/e2e` | Public pages, contact form, the full 15-step guided demo, role restrictions |

No real clinical data is needed for any test. The backend tests use an in-memory mock of both hospitals.

---

## Configuration

Copy `.env.example` to `.env` (setup does this). Key settings:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite by default; PostgreSQL supported (`postgresql+psycopg://…`) |
| `DEMO_MODE` | One-click demo sign-in, failure simulation, tamper demo, demo reset |
| `HOSPITAL_A_FHIR_URL`, `HOSPITAL_B_FHIR_URL` | Server-side only; never sent to browsers |
| `CHAIN_RPC_URL`, `ANCHOR_CONTRACT_ADDRESS`, `ANCHOR_PRIVATE_KEY` | Anchoring network |
| `CONTACT_WEBHOOK_URL` or `SMTP_*` + `CONTACT_TO` | Contact delivery — see [docs/contact-setup.md](docs/contact-setup.md) |
| `VITE_SITE_URL`, `VITE_CONTACT_EMAIL` | Canonical URLs, sitemap, public contact email |

For a hosted deployment: `ENVIRONMENT=hosted`, `COOKIE_SECURE=true`, strict `CORS_ORIGINS`, PostgreSQL,
`DEMO_MODE=false` unless it is a public demo, and never expose the simulator or chain ports. Build the
web app with `npm run build` and serve `apps/web/dist` with `/api` proxied to the API.

---

## What is simulated

| Area | In this repository |
|---|---|
| Hospitals | Two fictional organizations, each an independent FHIR R4 simulator process with its own database |
| Patient data | Synthetic, deterministic generator with real code systems (LOINC, SNOMED CT, RxNorm, CVX) |
| Approvals | Made by a demo administrator, not by real providers |
| Consent | A demo consent flag on confirmed patient links |
| Outages | Injected at Privexa's connector transport; real retry and monitoring code runs |
| Blockchain | Local Hardhat development network, single anchoring account |
| Marketplace | Curated directory of fictional systems and example applications |
| Identity | Local demo accounts; see [docs/auth-model.md](docs/auth-model.md) |

Before connecting to real systems, see **[docs/production-readiness.md](docs/production-readiness.md)**.
Technical decisions, including why there is no Docker, HAPI or Synthea, are in
**[docs/decisions.md](docs/decisions.md)**.

---

## Repository structure
```
apps/
  api/          FastAPI backend (modules: auth, organizations, connectors, fhir, applications,
                access_requests, policies, patients, data_requests, audit, blockchain, monitoring,
                stats, public, demo) + Alembic migrations
  web/          React + TypeScript + Vite + Tailwind (public site, workspaces, guided demo)
contracts/      AuditAnchor.sol, Hardhat tests, deploy script
simulator/      FHIR R4 hospital simulator and synthetic data seeder
scripts/        setup.py, dev.py, test.py
tests/          unit/, integration/, e2e/
docs/           decisions, auth model, contact setup, production readiness
```
