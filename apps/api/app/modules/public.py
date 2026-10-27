"""Unauthenticated public endpoints: integration directory and contact form."""

import logging
import smtplib
from email.message import EmailMessage
from typing import Literal

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..middleware import RateLimiter
from ..models import Application, ContactSubmission, Organization

router = APIRouter(tags=["public"])
log = logging.getLogger("privexa.contact")
contact_limiter = RateLimiter(limit=5, window_seconds=600)


@router.get("/public/directory")
def directory(db: Session = Depends(get_db)):
    systems = db.scalars(select(Organization).order_by(Organization.name)).all()
    apps = db.scalars(select(Application).where(Application.listed.is_(True)).order_by(Application.name)).all()
    return {
        "systems": [
            {"id": o.id, "name": o.name, "system_type": o.system_type, "fhir_version": o.fhir_version, "resource_types": o.resource_types, "sandbox_available": o.sandbox_available, "simulated": o.simulated}
            for o in systems
        ],
        "applications": [
            {"id": a.id, "name": a.name, "vendor_name": a.vendor_name, "use_case": a.use_case, "description": a.description, "requested_resource_types": a.requested_resource_types, "simulated": a.simulated}
            for a in apps
        ],
    }


class ContactIn(BaseModel):
    inquiry_type: Literal["provider", "vendor", "partnership", "general"]
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    organization: str = Field(min_length=1, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    systems: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=10, max_length=4000)
    website: str | None = None  # honeypot


def _deliver(sub: ContactSubmission) -> tuple[str, bool, str | None]:
    s = get_settings()
    text = f"New {sub.inquiry_type} inquiry\n\nName: {sub.name}\nEmail: {sub.email}\nOrganization: {sub.organization}\nRole: {sub.role or '-'}\nSystems/product: {sub.systems or '-'}\n\n{sub.message}\n\nReference: {sub.id}"
    if s.contact_webhook_url:
        try:
            r = httpx.post(s.contact_webhook_url, json={"text": text, "submission_id": sub.id, "inquiry_type": sub.inquiry_type}, timeout=8)
            r.raise_for_status()
            return "webhook", True, None
        except Exception as e:  # noqa: BLE001
            return "webhook", False, f"Webhook delivery failed ({type(e).__name__})"
    if s.smtp_host and s.contact_to and s.smtp_from:
        try:
            msg = EmailMessage()
            msg["Subject"] = f"[Privexa] {sub.inquiry_type.title()} inquiry from {sub.organization}"
            msg["From"], msg["To"], msg["Reply-To"] = s.smtp_from, s.contact_to, sub.email
            msg.set_content(text)
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
                smtp.starttls()
                if s.smtp_username:
                    smtp.login(s.smtp_username, s.smtp_password)
                smtp.send_message(msg)
            return "smtp", True, None
        except Exception as e:  # noqa: BLE001
            return "smtp", False, f"Email delivery failed ({type(e).__name__})"
    return "none", False, None


@router.post("/contact", status_code=201, dependencies=[Depends(contact_limiter)])
def contact(body: ContactIn, db: Session = Depends(get_db)):
    if body.website:
        # Honeypot filled: likely automated. Accept without storing.
        return {"id": "0" * 36, "stored": False, "delivered": False, "delivery": "none", "message": "Thanks — your message has been received."}
    sub = ContactSubmission(
        inquiry_type=body.inquiry_type, name=body.name.strip(), email=str(body.email).lower(), organization=body.organization.strip(),
        role=(body.role or "").strip() or None, systems=(body.systems or "").strip() or None, message=body.message.strip(),
    )
    db.add(sub)
    db.commit()
    delivery, delivered, err = _deliver(sub)
    sub.delivery, sub.delivered, sub.delivery_error = delivery, delivered, err
    db.commit()
    log.info("contact submission %s stored (delivery=%s delivered=%s)", sub.id, delivery, delivered)
    if delivered:
        message = "Your message has been sent to the Privexa team. We'll reply to your work email."
    elif delivery == "none":
        message = "Your message has been securely stored. Automatic notification isn't configured yet, so the team will review it from the submissions inbox."
    else:
        message = "Your message has been stored, but the notification to our team failed. It will still be reviewed from the submissions inbox."
    return {"id": sub.id, "stored": True, "delivered": delivered, "delivery": delivery, "message": message}
