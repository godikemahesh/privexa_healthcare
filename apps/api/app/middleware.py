import json
import logging
import re
import secrets
import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from .errors import ApiError

log = logging.getLogger("privexa.http")
_REQ_ID = re.compile(r"^[A-Za-z0-9_-]{6,64}$")


def new_request_id() -> str:
    return "req_" + secrets.token_hex(6)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a request ID and writes a structured access log line (no bodies, no clinical content)."""

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("X-Request-ID", "")
        request.state.request_id = incoming if _REQ_ID.match(incoming) else new_request_id()
        started = time.perf_counter()
        response = await call_next(request)
        ms = round((time.perf_counter() - started) * 1000, 1)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        log.info(json.dumps({"request_id": request.state.request_id, "method": request.method, "path": request.url.path, "status": response.status_code, "ms": ms}))
        return response


class RateLimiter:
    """In-memory sliding-window limiter. Suitable for a single-process demo; use a shared store in production."""

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        key = f"{request.url.path}:{request.client.host if request.client else 'anon'}"
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise ApiError(429, "rate_limited", "Too many requests. Please wait a moment and try again.")
        q.append(now)

    def reset(self) -> None:
        self.hits.clear()
