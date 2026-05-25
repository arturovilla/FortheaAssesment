"""Response models for the /performance endpoint."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class PerformanceRow(BaseModel):
    """One client-day from `marts.mart_client_daily_performance`."""

    client_id: str
    client_name: str
    activity_date: date
    total_spend: Decimal
    total_conversions: Decimal
    expected_revenue_from_acquisition: Decimal
    total_revenue: Decimal
    cpa: Decimal | None
    roas: Decimal | None


class PerformanceResponse(BaseModel):
    items: list[PerformanceRow]
    next_cursor: str | None = None
    has_more: bool = False
