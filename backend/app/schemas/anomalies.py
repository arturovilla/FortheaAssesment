"""Response models for the /anomalies endpoint."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel


class AnomalyFlag(str, Enum):
    """The four flag types the mart view emits (Part 3 §10.3)."""

    zero_conversions = "zero_conversions"   # is_zero_conversions_with_spend
    cpa_spike = "cpa_spike"                 # is_cpa_spike
    roas_collapse = "roas_collapse"         # is_roas_collapse
    spend_spike = "spend_spike"             # is_spend_spike


class AnomalyRow(BaseModel):
    """One flagged client-day from `marts.mart_client_daily_anomalies`."""

    client_id: str
    client_name: str
    activity_date: date
    total_spend: Decimal
    total_conversions: Decimal
    cpa: Decimal | None
    roas: Decimal | None
    cpa_zscore: Decimal | None
    roas_zscore: Decimal | None
    is_zero_conversions_with_spend: bool
    is_cpa_spike: bool
    is_roas_collapse: bool
    is_spend_spike: bool


class AnomaliesResponse(BaseModel):
    items: list[AnomalyRow]
    next_cursor: str | None = None
    has_more: bool = False
