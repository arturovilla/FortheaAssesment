"""FastAPI app entry point.

Run with:
    uvicorn app.main:app --reload          # dev, from backend/
    uvicorn app.main:app --host 0.0.0.0 --port 8000   # prod
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import anomalies, clients, health, macro, me, performance, uploads
from app.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Forthea Backend",
        version="0.1.0",
        docs_url="/docs",
        redoc_url=None,
        # Surface the current env in the OpenAPI title so it's obvious which
        # backend the dashboard is talking to during demos.
        description=f"Multi-tenant analytics API. env={settings.app_env}",
    )

    # CORS — the Next.js dashboard hits this from a different origin in dev.
    # `allow_credentials=True` requires explicit origins (no "*"); the dashboard
    # sends `Authorization: Bearer …` so credentialed mode is non-negotiable.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Active-Tenant"],
    )

    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(clients.router)
    app.include_router(performance.router)
    app.include_router(anomalies.router)
    app.include_router(uploads.router)
    app.include_router(macro.router)
    return app


app = create_app()
