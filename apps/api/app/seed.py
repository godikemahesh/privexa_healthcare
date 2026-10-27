"""Seed demo organizations, users, applications, grants and policies. Safe to rerun.

Usage: python -m app.seed
"""

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import SessionLocal
from .models import AccessRequest, Application, Connection, Organization, Policy, PolicyVersion, User
from .modules.auth import DEMO_USERS, add_membership, hash_password
from .modules.fhir import SUPPORTED_RESOURCE_TYPES

ORGS = [
    {"slug": "metrocare", "name": "MetroCare Medical Center", "system_type": "Hospital EHR (simulated HAPI FHIR server)", "env": "hospital_a_fhir_url"},
    {"slug": "sunrise", "name": "Sunrise General Hospital", "system_type": "Hospital HMS (simulated HAPI FHIR server)", "env": "hospital_b_fhir_url"},
]

APPS = [
    {
        "key": "cardio",
        "name": "Cardio Insights",
        "vendor": "Northwind Health AI",
        "use_case": "Cardiovascular risk summaries for care teams",
        "description": "Summarizes vital signs, encounters and conditions across visits to help care teams spot cardiovascular risk.",
        "purpose": "care_coordination",
        "types": ["Condition", "Encounter", "MedicationRequest", "Observation"],
        "owned_by_vendor": True,
        "grants": {"metrocare": ["Condition", "Encounter", "MedicationRequest", "Observation"], "sunrise": ["Condition", "Encounter", "Observation"]},
    },
    {
        "key": "careloop",
        "name": "CareLoop Coordination",
        "vendor": "CareLoop Labs",
        "use_case": "Discharge follow-up and care coordination",
        "description": "Helps coordinators follow up after discharge using recent encounters and active medications.",
        "purpose": "care_coordination",
        "types": ["Encounter", "MedicationRequest"],
        "owned_by_vendor": False,
        "grants": {"metrocare": ["Encounter", "MedicationRequest"]},
    },
    {
        "key": "trialfinder",
        "name": "Trial Finder",
        "vendor": "Bluebird Research",
        "use_case": "Clinical trial eligibility screening",
        "description": "Screens synthetic records for potential clinical trial eligibility. Awaiting provider approval.",
        "purpose": "research",
        "types": ["Condition", "MedicationRequest", "Observation"],
        "owned_by_vendor": True,
        "grants": {},
        "pending": "metrocare",
    },
]

POLICIES = {
    "metrocare": [
        ("Require active consent", "Deny all data sharing when the patient's demo consent state is withdrawn.", True, {"require_active_consent": True}),
        ("No medication data for research", "Medication data may not be shared for research purposes.", True, {"resource_types": ["MedicationRequest"], "purposes": ["research"]}),
    ],
    "sunrise": [
        ("Require active consent", "Deny all data sharing when the patient's demo consent state is withdrawn.", True, {"require_active_consent": True}),
        ("Restrict allergy data", "Test policy: block AllergyIntolerance for all applications.", False, {"resource_types": ["AllergyIntolerance"]}),
    ],
}


def _rule(extra: dict) -> dict:
    return {"effect": "deny", "resource_types": [], "purposes": [], "application_ids": [], "require_active_consent": False, **extra}


def seed(db: Session) -> None:
    pw = hash_password(get_settings().demo_password)
    orgs: dict[str, Organization] = {}
    for o in ORGS:
        org = db.scalar(select(Organization).where(Organization.slug == o["slug"]))
        if not org:
            org = Organization(slug=o["slug"], name=o["name"], system_type=o["system_type"], fhir_version="R4", simulated=True, resource_types=SUPPORTED_RESOURCE_TYPES)
            db.add(org)
            db.flush()
            db.add(Connection(organization_id=org.id, base_url_env=o["env"]))
        orgs[o["slug"]] = org
    db.flush()

    def user(email: str, name: str, role: str, vendor: str | None = None) -> User:
        u = db.scalar(select(User).where(User.email == email))
        if not u:
            u = User(email=email, name=name, role=role, vendor_name=vendor, password_hash=pw)
            db.add(u)
            db.flush()
        return u

    provider = user(DEMO_USERS["provider_admin"], "Dr. Meera Iyer (demo)", "provider_admin")
    for org in orgs.values():
        add_membership(db, provider, org)
    metro_only = user("provider.metrocare@demo.privexa.local", "MetroCare integration lead (demo)", "provider_admin")
    add_membership(db, metro_only, orgs["metrocare"])
    vendor = user(DEMO_USERS["vendor_dev"], "Arjun Rao (demo)", "vendor_dev", "Northwind Health AI")
    user(DEMO_USERS["demo_admin"], "Demo administrator", "demo_admin")
    db.flush()

    apps: dict[str, Application] = {}
    for a in APPS:
        app = db.scalar(select(Application).where(Application.name == a["name"], Application.listed.is_(True)))
        if not app:
            app = Application(
                owner_id=vendor.id if a["owned_by_vendor"] else None,
                vendor_name=a["vendor"],
                name=a["name"],
                description=a["description"],
                use_case=a["use_case"],
                purpose=a["purpose"],
                requested_resource_types=a["types"],
                client_id="pvx_dev_" + secrets.token_hex(8),
                client_secret_hash=hash_password(secrets.token_urlsafe(24)),
                simulated=True,
                listed=True,
            )
            db.add(app)
            db.flush()
            for slug, types in a["grants"].items():
                db.add(AccessRequest(application_id=app.id, organization_id=orgs[slug].id, resource_types=types, purpose=a["purpose"], status="approved", decision_reason="Approved for demonstration", justification="Seeded demonstration grant"))
            if a.get("pending"):
                db.add(AccessRequest(application_id=app.id, organization_id=orgs[a["pending"]].id, resource_types=a["types"], purpose=a["purpose"], status="submitted", justification="Screening synthetic records for trial eligibility"))
        apps[a["key"]] = app

    for slug, items in POLICIES.items():
        for name, desc, enabled, rule in items:
            if not db.scalar(select(Policy).where(Policy.organization_id == orgs[slug].id, Policy.name == name)):
                p = Policy(organization_id=orgs[slug].id, name=name, description=desc, enabled=enabled, version=1, rule=_rule(rule))
                db.add(p)
                db.flush()
                db.add(PolicyVersion(policy_id=p.id, version=1, enabled=enabled, rule=p.rule))
    db.commit()


if __name__ == "__main__":
    s = SessionLocal()
    try:
        seed(s)
        print("Seeded demo organizations, users, applications and policies.")
    finally:
        s.close()
