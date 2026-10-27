# Before connecting to real healthcare systems

This repository is a working **demonstration**. These items must be completed before any real
provider system, real patient data or real users are involved.

## Legal, regulatory and governance
- Qualified legal assessment for each market (in India: the DPDP Act and Rules as commenced, ABDM
  policies where relevant; elsewhere the applicable frameworks). Make no compliance claims until done.
- Data processing agreements with each provider; vendor terms covering permitted use.
- A defined clinical safety boundary — Privexa moves data, it does not make clinical decisions.
- Real consent handling where required, replacing the demo consent flag.

## Identity and access
- Enterprise identity provider (OIDC/SAML) with MFA for workspace users; disable `DEMO_MODE`.
- OAuth 2.0 client credentials / SMART Backend Services with short-lived tokens for applications.
- Provider-side approval workflows signed off by authorized provider staff (not a demo administrator).

## Connectivity
- Connector per real system (FHIR R4 servers, vendor APIs, HL7 v2 where justified), each validated
  against the provider's actual interface and data quality.
- Mutual TLS or equivalent to provider endpoints; secrets in a managed secret store.
- ABDM workflows implemented strictly to their published specifications and onboarding requirements.

## Platform
- PostgreSQL (managed, encrypted, backed up) instead of SQLite; run Alembic migrations in CI/CD.
- Shared rate limiting (e.g. Redis) and multi-instance deployment; the anchor worker then needs a
  single-leader lock.
- Do not expose simulator ports; serve only the web app and API behind TLS; set `COOKIE_SECURE=true`,
  `ENVIRONMENT=hosted` (disables the interactive API docs) and a strict `CORS_ORIGINS`.
- Centralized structured logging and alerting; log retention policy.

## Audit anchoring
- Choose the anchoring network deliberately (permissioned consortium chain, public L2, or a
  transparency log) and document what it proves. The local Hardhat chain proves the mechanism only.
- Key management for the anchoring account (HSM/KMS), batching (Merkle roots) for volume.

## Assurance
- Independent security review and penetration test; threat model; dependency scanning.
- Data-retention and deletion policies; incident response plan.
