"""GET /health — liveness + DB reachability check.

Two questions this endpoint answers:
  1. Is the app process running and accepting traffic?  (200 is the answer)
  2. Can it reach Postgres?                              (the `database` field)

Used by Docker Compose / Kubernetes / load-balancer health checks. Returning
non-200 when the DB is unreachable causes the orchestrator to stop sending
traffic to this instance.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.settings import get_settings

router = APIRouter(tags=["meta"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> JSONResponse:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except SQLAlchemyError:
        db_status = "unavailable"

    code = (
        status.HTTP_200_OK
        if db_status == "ok"
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(
        {
            "status": "ok" if db_status == "ok" else "degraded",
            "database": db_status,
            "env": get_settings().app_env,
        },
        status_code=code,
    )
