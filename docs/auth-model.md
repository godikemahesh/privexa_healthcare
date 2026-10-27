# Demo authentication & authorization model

## Users and roles
| Role | Can do | Cannot do |
|---|---|---|
| `provider_admin` | View and test connections, review access requests, manage policies, review patient matches, view audit and health — **only for organizations they belong to** | Register applications, act on other organizations, use demo-only admin controls |
| `vendor_dev` | Register applications, rotate credentials, request access, use the sandbox and API explorer, view audit events for **their own applications** | See connection details, approve requests, search patients, view other vendors' data |
| `demo_admin` | Everything a provider can do for all organizations; send requests on behalf of demo applications; suspend applications; simulate tampering; reset the demo | — |

Demo accounts (password `DEMO_PASSWORD`, default `privexa-demo`):
`provider@demo.privexa.local` (both hospitals), `provider.metrocare@demo.privexa.local` (MetroCare only —
used to demonstrate organization isolation), `vendor@demo.privexa.local`, `admin@demo.privexa.local`.
With `DEMO_MODE=true` the site also offers one-click demo sign-in.

## Sessions
* Passwords are hashed with Argon2.
* Sign-in creates a random session token; only its SHA-256 hash is stored. It is sent as an
  `HttpOnly`, `SameSite=Lax` cookie (`Secure` when `COOKIE_SECURE=true`).
* A second, readable cookie carries a CSRF token that must be echoed in `X-CSRF-Token` on every
  non-GET request (double-submit check on the server).
* Sign-in endpoints are rate limited.

## Applications
Applications receive a development client ID and secret. The secret is shown once, stored as an
Argon2 hash, and can be rotated. Applications call `POST /api/v1/data-requests` with `X-Client-Id` and
`X-Client-Secret` from server-side code. Browser pages never hold a client secret.

## Enforcement
Every protected endpoint checks the role (`require_roles`) and, where relevant, organization membership
(`ensure_org_access`) or application ownership on the server. Hiding a button in the UI is never relied
upon; the test suite calls the API directly to prove it.

## Moving to production identity
`current_user` in `apps/api/app/modules/auth.py` is the single integration point. Replace it with
validation of tokens from an OIDC/SAML identity provider (with MFA), map IdP groups to the three roles and
organization memberships, and disable `DEMO_MODE`. Application credentials should move to OAuth 2.0
client credentials (or SMART Backend Services) with short-lived tokens.
