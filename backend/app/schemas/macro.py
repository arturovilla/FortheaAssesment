"""Response models for the /macro endpoint."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class Observation(BaseModel):
    """One data point in a FRED time series. `value` is None if FRED reported '.'."""

    date: date
    value: Decimal | None


class MacroSeries(BaseModel):
    key: str         # the friendly name from SERIES_REGISTRY (e.g. "inflation")
    series_id: str   # the upstream FRED series ID (e.g. "CPIAUCSL")
    title: str       # human-readable description
    observations: list[Observation]


class MacroResponse(BaseModel):
    items: list[MacroSeries]
