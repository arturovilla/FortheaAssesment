"""GET /anomalies — paginated flagged client-days for the active tenant.

Source: `marts.mart_client_daily_anomalies` (the view built by migration
0002, defined in Part 3 §10.2). The view already filters to rows that
trip at least one flag; this endpoint adds tenant scoping, optional date
range, and an optional `flag_type` filter for narrower dashboard views.

Pagination shape and cursor format match /performance — same cursor key
`{"d": "<date>", "c": "<client_id>"}` and same sort order.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import current_tenant
from app.db import queries
from app.db.session import get_tenant_scoped_db
from app.schemas.anomalies import AnomaliesResponse, AnomalyFlag
from app.util.cursor import decode_cursor, encode_cursor

router = APIRouter(tags=["anomalies"])


@router.get("/anomalies", response_model=AnomaliesResponse)
def get_anomalies(
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_tenant_scoped_db)],
    start_date: Annotated[date | None, Query(description="Inclusive lower bound on activity_date.")] = None,
    end_date: Annotated[date | None, Query(description="Inclusive upper bound on activity_date.")] = None,
    flag_type: Annotated[
        AnomalyFlag | None,
        Query(description="Restrict to one flag: zero_conversions, cpa_spike, roas_collapse, spend_spike."),
    ] = None,
    cursor: Annotated[str | None, Query(description="Opaque cursor returned by a previous call.")] = None,
    limit: Annotated[int, Query(ge=1, le=500, description="Page size; default 50, max 500.")] = 50,
) -> AnomaliesResponse:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be on or before end_date.",
        )

    cursor_date: date | None = None
    cursor_client_id: str | None = None
    if cursor:
        decoded = decode_cursor(cursor)
        try:
            cursor_date = date.fromisoformat(decoded["d"])
            cursor_client_id = str(decoded["c"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cursor is malformed for this endpoint.",
            )

    rows = queries.list_anomalies(
        db,
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        flag_type=flag_type,
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

    return AnomaliesResponse(items=items, has_more=has_more, next_cursor=next_cursor)
