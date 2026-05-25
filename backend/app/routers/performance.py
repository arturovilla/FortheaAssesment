"""GET /performance — paginated daily CPA / ROAS for the active tenant.

Source: `marts.mart_client_daily_performance` (the view built by migration
0002). Tenant scoping is applied in the SQL via the `current_tenant`
dependency — the route never reads tenant from the request.

Pagination is cursor-based (Part 2 §5):
  - Server emits `next_cursor` whenever there's another page.
  - Client passes it back as `?cursor=...` for the next request.
  - Cursor is opaque base64; see app/util/cursor.py.

Sort order is fixed (`activity_date DESC, client_id DESC`) so the cursor's
"strictly less than" comparison stays correct across pages.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import current_tenant
from app.db import queries
from app.db.session import get_tenant_scoped_db
from app.schemas.performance import PerformanceResponse
from app.util.cursor import decode_cursor, encode_cursor

router = APIRouter(tags=["performance"])


@router.get("/performance", response_model=PerformanceResponse)
def get_performance(
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_tenant_scoped_db)],
    start_date: Annotated[date | None, Query(description="Inclusive lower bound on activity_date.")] = None,
    end_date: Annotated[date | None, Query(description="Inclusive upper bound on activity_date.")] = None,
    cursor: Annotated[str | None, Query(description="Opaque cursor returned by a previous call.")] = None,
    limit: Annotated[int, Query(ge=1, le=500, description="Page size; default 50, max 500.")] = 50,
) -> PerformanceResponse:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be on or before end_date.",
        )

    cursor_date: date | None = None
    cursor_client_id: str | None = None
    if cursor:
        decoded = decode_cursor(cursor)
        # Cursor shape for /performance: {"d": "YYYY-MM-DD", "c": "<client_id>"}.
        try:
            cursor_date = date.fromisoformat(decoded["d"])
            cursor_client_id = str(decoded["c"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cursor is malformed for this endpoint.",
            )

    rows = queries.list_performance(
        db,
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        cursor_date=cursor_date,
        cursor_client_id=cursor_client_id,
        limit=limit,
    )

    has_more = len(rows) > limit
    items = rows[:limit]

    next_cursor: str | None = None
    if has_more and items:
        last = items[-1]
        next_cursor = encode_cursor({"d": last.activity_date.isoformat(), "c": last.client_id})

    return PerformanceResponse(items=items, has_more=has_more, next_cursor=next_cursor)
