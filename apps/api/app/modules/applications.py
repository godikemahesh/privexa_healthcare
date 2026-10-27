"""Registered applications and their development credentials."""

import secrets
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, HttpUrl, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError, forbidden, not_found
from ..models import AccessRequest, Application, User
from .audit import record_event
from .auth import current_user, hash_password, org_ids_for, require_roles, verify_password
from .fhir import CLINICAL_RESOURCE_TYPES
from .policies import Purpose

router = APIRouter(prefix="/applications", tags=["applications"])


class ApplicationOut(BaseModel):
    id: str
    name: str
    description: str
    use_case: str
    requested_resource_types: list[str]
    purpose: str
    callback_url: str | None
    status: str
    client_id: str
    vendor_name: str
    simulated: bool
    created_at: datetime


class ApplicationCreated(ApplicationOut):
    client_secret: str
    secret_notice: str = "Shown once. Development credential for the sandbox only — store it securely and never embed it in browser code."


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=1000)
    use_case: str = Field(min_length=3, max_length=200)
    requested_resource_types: list[str] = Field(min_length=1)
    purpose: Purpose
    callback_url: HttpUrl | None = None

    @field_validator("requested_resource_types")
    @classmethod
    def _rt(cls, v: list[str]) -> list[str]:
        bad = [r for r in v if r not in CLINICAL_RESOURCE_TYPES]
        if bad:
            raise ValueError(f"Unsupported resource types: {', '.join(bad)}")
        return sorted(set(v))


def new_credentials() -> tuple[str, str]:
    return "pvx_dev_" + secrets.token_hex(8), "pvx_sk_dev_" + secrets.token_urlsafe(24)


def visible_apps_query(db: Session, user: User):
    q = select(Application)
    if user.role == "vendor_dev":
        return q.where(Application.owner_id == user.id)
    if user.role == "provider_admin":
        app_ids = select(AccessRequest.application_id).where(AccessRequest.organization_id.in_(org_ids_for(db, user)), AccessRequest.status != "draft")
        return q.where(Application.id.in_(app_ids))
    return q


def get_visible_app(db: Session, user: User, app_id: str) -> Application:
    app = db.scalar(visible_apps_query(db, user).where(Application.id == app_id))
    if not app:
        raise not_found("Application")
    return app


def authenticate_client(db: Session, client_id: str, client_secret: str) -> Application:
    app = db.scalar(select(Application).where(Application.client_id == client_id))
    if not app or not verify_password(client_secret, app.client_secret_hash):
        raise ApiError(401, "invalid_client", "Client credentials are invalid")
    return app


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(visible_apps_query(db, user).order_by(Application.created_at.desc())).all()


@router.post("", response_model=ApplicationCreated, status_code=201)
def register_application(body: ApplicationCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("vendor_dev", "demo_admin"))):
    client_id, secret = new_credentials()
    app = Application(
        owner_id=user.id,
        vendor_name=user.vendor_name or "Demo vendor",
        name=body.name,
        description=body.description,
        use_case=body.use_case,
        purpose=body.purpose,
        requested_resource_types=body.requested_resource_types,
        callback_url=str(body.callback_url) if body.callback_url else None,
        client_id=client_id,
        client_secret_hash=hash_password(secret),
        simulated=True,
    )
    db.add(app)
    db.commit()
    record_event(db, request_id=request.state.request_id, action="application_registered", outcome="success", application_id=app.id, actor_id=user.id, resource_types=app.requested_resource_types, purpose=app.purpose)
    return ApplicationCreated(**ApplicationOut.model_validate(app, from_attributes=True).model_dump(), client_secret=secret)


@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(app_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return get_visible_app(db, user, app_id)


@router.post("/{app_id}/rotate-secret")
def rotate_secret(app_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("vendor_dev", "demo_admin"))):
    app = get_visible_app(db, user, app_id)
    if user.role == "vendor_dev" and app.owner_id != user.id:
        raise forbidden()
    _, secret = new_credentials()
    app.client_secret_hash = hash_password(secret)
    db.commit()
    record_event(db, request_id=request.state.request_id, action="credentials_rotated", outcome="success", application_id=app.id, actor_id=user.id)
    return {"client_id": app.client_id, "client_secret": secret, "secret_notice": ApplicationCreated.model_fields["secret_notice"].default}


class StatusIn(BaseModel):
    status: Literal["active", "suspended"]


@router.patch("/{app_id}/status", response_model=ApplicationOut)
def set_status(app_id: str, body: StatusIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("demo_admin"))):
    app = db.get(Application, app_id)
    if not app:
        raise not_found("Application")
    app.status = body.status
    db.commit()
    record_event(db, request_id=request.state.request_id, action="application_status_changed", outcome="success", application_id=app.id, actor_id=user.id, reason=f"Status set to {body.status}")
    return app
