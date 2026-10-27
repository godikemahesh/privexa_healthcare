"""Privexa Connect: FHIR connectors to the simulated hospital systems.

Every call records an IntegrationJob (attempts, latency, errors) and updates connection health. Demo
fault modes are injected at the HTTP transport layer so the real timeout/retry/validation code runs.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Connection, IntegrationJob, Organization

FAULT_MODES = ("none", "timeout", "error", "malformed", "flaky")

# Test hook: organization slug -> transport (e.g. httpx.MockTransport). Never set in normal operation.
transport_overrides: dict[str, httpx.AsyncBaseTransport] = {}


class ConnectorError(Exception):
    def __init__(self, code: str, message: str, job_id: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.job_id = job_id


class FaultTransport(httpx.AsyncBaseTransport):
    """Wraps the real transport to simulate outages for demonstrations."""

    def __init__(self, inner: httpx.AsyncBaseTransport, mode: str, simulated_delay: float):
        self.inner = inner
        self.mode = mode
        self.delay = simulated_delay
        self.calls = 0

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        if self.mode == "timeout" or (self.mode == "flaky" and self.calls == 1):
            await asyncio.sleep(self.delay)
            raise httpx.ReadTimeout("simulated endpoint timeout", request=request)
        if self.mode == "error":
            return httpx.Response(503, json={"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "transient"}]}, request=request)
        resp = await self.inner.handle_async_request(request)
        if self.mode == "malformed" and resp.status_code == 200 and "/metadata" not in request.url.path:
            await resp.aread()
            broken = {"resourceType": "Bundle", "type": "searchset", "entry": [{"resource": {"resourceType": request.url.path.rstrip("/").split("/")[-1], "status": "???"}}]}
            return httpx.Response(200, content=json.dumps(broken).encode(), headers={"content-type": "application/fhir+json"}, request=request)
        return resp

    async def aclose(self) -> None:
        await self.inner.aclose()


@dataclass
class CallResult:
    data: Any
    job_id: str
    latency_ms: float
    attempts: int
    attempt_log: list = field(default_factory=list)


def base_url_for(conn: Connection) -> str:
    return getattr(get_settings(), conn.base_url_env)


class FhirConnector:
    def __init__(self, db: Session, org: Organization):
        self.db = db
        self.org = org
        self.conn = org.connection
        s = get_settings()
        self.timeout = s.fhir_timeout_seconds
        self.max_retries = s.fhir_max_retries
        inner = transport_overrides.get(org.slug) or httpx.AsyncHTTPTransport()
        transport: httpx.AsyncBaseTransport = inner
        if self.conn.fault_mode != "none":
            transport = FaultTransport(inner, self.conn.fault_mode, simulated_delay=min(self.timeout, 1.2))
        self.client = httpx.AsyncClient(base_url=base_url_for(self.conn), timeout=self.timeout, transport=transport, headers={"Accept": "application/fhir+json"})

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self.client.aclose()

    async def get(self, path: str, params: dict | None, *, request_id: str, operation: str) -> CallResult:
        log: list[dict] = []
        started = time.perf_counter()
        last_code, last_msg = "unknown", "Unknown error"
        for attempt in range(1, self.max_retries + 2):
            t0 = time.perf_counter()
            try:
                resp = await self.client.get(path, params=params)
                ms = round((time.perf_counter() - t0) * 1000, 1)
                if resp.status_code >= 500:
                    last_code, last_msg = "upstream_unavailable", f"Hospital system returned HTTP {resp.status_code}"
                    log.append({"attempt": attempt, "outcome": "error", "ms": ms, "error": last_msg})
                elif resp.status_code >= 400:
                    last_code, last_msg = "upstream_rejected", f"Hospital system rejected the request (HTTP {resp.status_code})"
                    log.append({"attempt": attempt, "outcome": "error", "ms": ms, "error": last_msg})
                    break  # client errors are not retried
                else:
                    try:
                        data = resp.json()
                    except ValueError:
                        last_code, last_msg = "malformed_response", "Hospital system returned a response that is not valid JSON"
                        log.append({"attempt": attempt, "outcome": "error", "ms": ms, "error": last_msg})
                        break
                    log.append({"attempt": attempt, "outcome": "success", "ms": ms})
                    total = round((time.perf_counter() - started) * 1000, 1)
                    job = self._record(request_id, operation, "success", log, total)
                    return CallResult(data=data, job_id=job.id, latency_ms=total, attempts=attempt, attempt_log=log)
            except httpx.TimeoutException:
                ms = round((time.perf_counter() - t0) * 1000, 1)
                last_code, last_msg = "timeout", "Hospital system did not respond in time"
                log.append({"attempt": attempt, "outcome": "timeout", "ms": ms, "error": last_msg})
            except httpx.TransportError:
                ms = round((time.perf_counter() - t0) * 1000, 1)
                last_code, last_msg = "unreachable", "Hospital system is unreachable"
                log.append({"attempt": attempt, "outcome": "error", "ms": ms, "error": last_msg})
            if attempt <= self.max_retries:
                await asyncio.sleep(0.2 * (2 ** (attempt - 1)))
        total = round((time.perf_counter() - started) * 1000, 1)
        job = self._record(request_id, operation, "failure", log, total, last_code, last_msg)
        raise ConnectorError(last_code, last_msg, job.id)

    def _record(self, request_id: str, operation: str, status: str, log: list, latency: float, code: str | None = None, msg: str | None = None) -> IntegrationJob:
        job = IntegrationJob(
            request_id=request_id,
            organization_id=self.org.id,
            operation=operation,
            status=status,
            attempts=len(log),
            attempt_log=log,
            latency_ms=latency,
            error_code=code,
            error_message=msg,
        )
        self.db.add(job)
        c = self.conn
        c.last_latency_ms = latency
        if status == "success":
            c.status = "degraded" if len(log) > 1 else "healthy"
            c.last_error = None
        else:
            c.status = "down"
            c.last_error = msg
        self.db.commit()
        return job

    async def capabilities(self, request_id: str) -> dict:
        res = await self.get("/metadata", None, request_id=request_id, operation="capabilities")
        cs = res.data if isinstance(res.data, dict) else {}
        if cs.get("resourceType") != "CapabilityStatement":
            raise ConnectorError("malformed_response", "Hospital system returned an invalid capability statement", res.job_id)
        types = sorted({r.get("type") for rest in cs.get("rest", []) for r in rest.get("resource", []) if r.get("type")})
        caps = {
            "fhir_version": cs.get("fhirVersion"),
            "software": (cs.get("software") or {}).get("name"),
            "formats": cs.get("format", []),
            "resource_types": types,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "latency_ms": res.latency_ms,
        }
        self.conn.capabilities = caps
        self.conn.last_health_check = datetime.now(timezone.utc)
        self.db.commit()
        return caps
