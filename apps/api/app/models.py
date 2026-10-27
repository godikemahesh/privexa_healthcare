"""Privexa data model. Clinical records stay in the hospital systems; only metadata needed for
access control, monitoring and audit is stored here."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    system_type: Mapped[str] = mapped_column(String(120))
    fhir_version: Mapped[str] = mapped_column(String(16), default="R4")
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    sandbox_available: Mapped[bool] = mapped_column(Boolean, default=True)
    resource_types: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    connection: Mapped["Connection"] = relationship(back_populates="organization", uselist=False)


class Connection(Base):
    __tablename__ = "connections"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), unique=True)
    base_url_env: Mapped[str] = mapped_column(String(64))  # name of the setting holding the endpoint, never the URL itself
    status: Mapped[str] = mapped_column(String(16), default="configured")
    fault_mode: Mapped[str] = mapped_column(String(16), default="none")
    last_health_check: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_latency_ms: Mapped[float | None] = mapped_column(Float)
    last_error: Mapped[str | None] = mapped_column(String(300))
    capabilities: Mapped[dict | None] = mapped_column(JSON)

    organization: Mapped[Organization] = relationship(back_populates="connection")


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(32))  # provider_admin | vendor_dev | demo_admin
    vendor_name: Mapped[str | None] = mapped_column(String(120))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    memberships: Mapped[list["UserOrganization"]] = relationship(cascade="all, delete-orphan")


class UserOrganization(Base):
    __tablename__ = "user_organizations"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), primary_key=True)


class UserSession(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    vendor_name: Mapped[str] = mapped_column(String(120))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    use_case: Mapped[str] = mapped_column(String(200), default="")
    purpose: Mapped[str] = mapped_column(String(64))
    requested_resource_types: Mapped[list] = mapped_column(JSON, default=list)
    callback_url: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(16), default="active")
    client_id: Mapped[str] = mapped_column(String(64), unique=True)
    client_secret_hash: Mapped[str] = mapped_column(String(200))
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    listed: Mapped[bool] = mapped_column(Boolean, default=False)  # shown in the public directory
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AccessRequest(Base):
    """A vendor's request for access to an organization. Once approved, it acts as the grant (scopes)."""

    __tablename__ = "access_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    resource_types: Mapped[list] = mapped_column(JSON, default=list)
    purpose: Mapped[str] = mapped_column(String(64))
    justification: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="draft")
    decision_reason: Mapped[str | None] = mapped_column(String(300))
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

    application: Mapped[Application] = relationship()
    organization: Mapped[Organization] = relationship()


class Policy(Base):
    __tablename__ = "policies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    rule: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class PolicyVersion(Base):
    __tablename__ = "policy_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    enabled: Mapped[bool] = mapped_column(Boolean)
    rule: Mapped[dict] = mapped_column(JSON)
    changed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("policy_id", "version"),)


class PatientLink(Base):
    """A reviewed cross-organization match between synthetic patient records (references only)."""

    __tablename__ = "patient_links"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    label: Mapped[str] = mapped_column(String(120))
    members: Mapped[list] = mapped_column(JSON)  # [{organization_id, patient_id, mrn}]
    member_key: Mapped[str] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(String(16))  # confirmed | rejected
    score: Mapped[float] = mapped_column(Float)
    consent_status: Mapped[str] = mapped_column(String(16), default="active")
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class IntegrationJob(Base):
    """One connector operation against a hospital system, including retries."""

    __tablename__ = "integration_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    operation: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16))
    attempts: Mapped[int] = mapped_column(Integer, default=1)
    attempt_log: Mapped[list] = mapped_column(JSON, default=list)
    latency_ms: Mapped[float | None] = mapped_column(Float)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    outcome: Mapped[str] = mapped_column(String(16), index=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    resource_types: Mapped[list] = mapped_column(JSON, default=list)
    purpose: Mapped[str | None] = mapped_column(String(64))
    reason: Mapped[str | None] = mapped_column(String(500))
    details: Mapped[dict] = mapped_column(JSON, default=dict)  # non-clinical metadata only
    fingerprint: Mapped[str] = mapped_column(String(66))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)

    anchor: Mapped["BlockchainAnchor | None"] = relationship(back_populates="audit_event", uselist=False)


class BlockchainAnchor(Base):
    __tablename__ = "blockchain_anchors"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    audit_event_id: Mapped[str] = mapped_column(ForeignKey("audit_events.id"), unique=True)
    fingerprint: Mapped[str] = mapped_column(String(66))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | anchored | failed
    tx_hash: Mapped[str | None] = mapped_column(String(66))
    block_number: Mapped[int | None] = mapped_column(Integer)
    chain_id: Mapped[int | None] = mapped_column(Integer)
    contract_address: Mapped[str | None] = mapped_column(String(42))
    error: Mapped[str | None] = mapped_column(String(300))
    last_verification: Mapped[str | None] = mapped_column(String(16))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

    audit_event: Mapped[AuditEvent] = relationship(back_populates="anchor")


class ContactSubmission(Base):
    __tablename__ = "contact_submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    inquiry_type: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    organization: Mapped[str] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(200))
    systems: Mapped[str | None] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    delivery: Mapped[str] = mapped_column(String(16), default="none")
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_error: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
