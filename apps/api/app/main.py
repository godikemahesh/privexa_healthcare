import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import errors
from .config import get_settings
from .middleware import RequestContextMiddleware
from .modules import (
    access_requests,
    applications,
    audit,
    auth,
    data_requests,
    demo,
    monitoring,
    organizations,
    patients,
    policies,
    public,
    stats,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

API_DESCRIPTION = """
The Privexa API for the demonstration environment.

**Authentication.** Workspace users authenticate with a session cookie (and send the `X-CSRF-Token`
header on writes). Applications call `POST /api/v1/data-requests` with `X-Client-Id` and
`X-Client-Secret` development credentials issued when the application is registered.

All systems and records behind this API are simulated. Data is synthetic.
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    worker = None
    if s.anchor_enabled and s.anchor_worker:
        from .modules.blockchain import AnchorWorker

        worker = AnchorWorker()
        worker.start()
    yield
    if worker:
        worker.stop()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        lifespan=lifespan,
        title="Privexa API",
        version="0.1.0",
        description=API_DESCRIPTION,
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs" if s.environment != "hosted" else None,
        redoc_url=None,
    )
    errors.install(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID", "X-Client-Id", "X-Client-Secret"],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(RequestContextMiddleware)
    for m in (auth, organizations, applications, access_requests, policies, patients, data_requests, audit, monitoring, stats, public, demo):
        app.include_router(m.router, prefix="/api/v1")

    @app.get("/api/v1/health", tags=["public"])
    def health():
        return {"status": "ok", "environment": s.environment, "demo_mode": s.demo_mode}

    return app


app = create_app()
