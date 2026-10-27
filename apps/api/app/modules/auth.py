"""Local demo authentication.

Users sign in with email/password (Argon2 hashes) and receive an HttpOnly session cookie plus a readable
CSRF cookie that must be echoed in the X-CSRF-Token header on mutating requests. Roles are enforced on the
server for every protected endpoint. A production deployment would swap this module for an OIDC provider;
the `current_user` dependency is the single integration point.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..errors import ApiError, forbidden
from ..middleware import RateLimiter
from ..models import Organization, User, UserOrganization, UserSession

router = APIRouter(prefix="/auth", tags=["auth"])
_ph = PasswordHasher()
SESSION_COOKIE = "privexa_session"
CSRF_COOKIE = "privexa_csrf"
login_limiter = RateLimiter(limit=10, window_seconds=60)

Role = Literal["provider_admin", "vendor_dev", "demo_admin"]

DEMO_USERS: dict[str, str] = {
    "provider_admin": "provider@demo.privexa.local",
    "vendor_dev": "vendor@demo.privexa.local",
    "demo_admin": "admin@demo.privexa.local",
}


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, pw)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def org_ids_for(db: Session, user: User) -> list[str]:
    if user.role == "demo_admin":
        return list(db.scalars(select(Organization.id)))
    if user.role == "provider_admin":
        return [m.organization_id for m in user.memberships]
    return []


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    organization_ids: list[str]
    vendor_name: str | None


def user_out(db: Session, user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, name=user.name, role=user.role, organization_ids=org_ids_for(db, user), vendor_name=user.vendor_name)  # type: ignore[arg-type]


def _start_session(db: Session, response: Response, user: User) -> None:
    s = get_settings()
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    db.add(UserSession(token_hash=_token_hash(token), csrf_token=csrf, user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(hours=s.session_ttl_hours)))
    db.commit()
    max_age = s.session_ttl_hours * 3600
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", secure=s.cookie_secure, max_age=max_age, path="/")
    response.set_cookie(CSRF_COOKIE, csrf, httponly=False, samesite="lax", secure=s.cookie_secure, max_age=max_age, path="/")


def _session_for(request: Request, db: Session) -> UserSession | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == _token_hash(token)))
    if not sess:
        return None
    exp = sess.expires_at if sess.expires_at.tzinfo else sess.expires_at.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        db.delete(sess)
        db.commit()
        return None
    return sess


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    sess = _session_for(request, db)
    if not sess:
        raise ApiError(401, "unauthenticated", "Please sign in to continue")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if not secrets.compare_digest(request.headers.get("X-CSRF-Token", ""), sess.csrf_token):
            raise ApiError(403, "csrf_failed", "Security token missing or invalid. Please refresh and try again.")
    user = db.get(User, sess.user_id)
    if not user:
        raise ApiError(401, "unauthenticated", "Please sign in to continue")
    return user


def require_roles(*roles: Role):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise forbidden()
        return user

    return dep


def ensure_org_access(db: Session, user: User, organization_id: str) -> None:
    """Organization-level isolation: providers only act on organizations they belong to."""
    if user.role == "demo_admin":
        return
    if user.role == "provider_admin" and organization_id in org_ids_for(db, user):
        return
    raise forbidden("You don't have access to this organization")


class LoginIn(BaseModel):
    # Shape check only: demo accounts use the reserved .local domain, which strict validators reject.
    email: str = Field(min_length=3, max_length=200, pattern=r"^[^@\s]+@[^@\s]+$")
    password: str = Field(min_length=1, max_length=200)


class DemoLoginIn(BaseModel):
    role: Role


@router.post("/login", response_model=UserOut, dependencies=[Depends(login_limiter)])
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise ApiError(401, "invalid_credentials", "Email or password is incorrect")
    _start_session(db, response, user)
    return user_out(db, user)


@router.post("/demo-login", response_model=UserOut, dependencies=[Depends(login_limiter)])
def demo_login(body: DemoLoginIn, response: Response, db: Session = Depends(get_db)):
    if not get_settings().demo_mode:
        raise ApiError(404, "not_found", "Demo sign-in is not enabled")
    user = db.scalar(select(User).where(User.email == DEMO_USERS[body.role]))
    if not user:
        raise ApiError(503, "demo_not_seeded", "Demo accounts are not set up yet. Run the seed command.")
    _start_session(db, response, user)
    return user_out(db, user)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    sess = _session_for(request, db)
    if sess:
        db.delete(sess)
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return user_out(db, user)


def add_membership(db: Session, user: User, org: Organization) -> None:
    if not db.get(UserOrganization, (user.id, org.id)):
        db.add(UserOrganization(user_id=user.id, organization_id=org.id))
