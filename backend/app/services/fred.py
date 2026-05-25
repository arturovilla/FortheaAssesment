"""FRED API client + in-process TTL cache.

The /macro endpoint reads a small fixed set of indicator series from FRED
(St Louis Fed's free economic data API). Responses are cached for one hour
in a process-local dict — FRED series update at most monthly, so a one-hour
TTL is conservative and keeps us well under FRED's 120-req/min ceiling.

A real deployment would swap this for a shared cache (Redis) so multiple
backend pods don't each hit FRED independently; the function signature stays
the same.
"""

from __future__ import annotations

import time
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Final

import httpx
from fastapi import HTTPException, status

from app.schemas.macro import Observation
from app.settings import get_settings

FRED_URL: Final = "https://api.stlouisfed.org/fred/series/observations"
_TTL_SECONDS: Final = 60 * 60   # 1 hour
_HTTP_TIMEOUT: Final = 10.0

# Friendly key → (FRED series ID, human title). Keep this small and curated;
# the dashboard isn't a general FRED browser.
SERIES_REGISTRY: Final[dict[str, tuple[str, str]]] = {
    "inflation":    ("CPIAUCSL", "Consumer Price Index for All Urban Consumers"),
    "unemployment": ("UNRATE",   "Unemployment Rate"),
    "sentiment":    ("UMCSENT",  "University of Michigan Consumer Sentiment Index"),
    "fed_funds":    ("DFF",      "Federal Funds Effective Rate"),
}

# Cache: (series_id, start_iso_or_None, end_iso_or_None) → (timestamp, observations)
_cache: dict[tuple[str, str | None, str | None], tuple[float, list[Observation]]] = {}


def fetch_observations(
    series_id: str,
    start_date: date | None,
    end_date: date | None,
) -> list[Observation]:
    """Return a series' observations, hitting FRED only on cache miss / expiry."""
    settings = get_settings()
    if not settings.fred_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FRED API key not configured. Set FRED_API_KEY in backend/.env.local.",
        )

    key = (series_id, start_date.isoformat() if start_date else None,
           end_date.isoformat() if end_date else None)
    cached = _cache.get(key)
    if cached is not None and time.time() - cached[0] < _TTL_SECONDS:
        return cached[1]

    params: dict[str, str] = {
        "series_id": series_id,
        "api_key": settings.fred_api_key,
        "file_type": "json",
    }
    if start_date:
        params["observation_start"] = start_date.isoformat()
    if end_date:
        params["observation_end"] = end_date.isoformat()

    try:
        response = httpx.get(FRED_URL, params=params, timeout=_HTTP_TIMEOUT)
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"FRED returned {e.response.status_code}: {e.response.text[:200]}",
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"FRED request failed: {e}",
        )

    observations = [_parse_observation(o) for o in response.json().get("observations", [])]
    _cache[key] = (time.time(), observations)
    return observations


def _parse_observation(raw: dict) -> Observation:
    # FRED uses "." to signal a missing observation; everything else is a number string.
    value: Decimal | None
    if raw["value"] == ".":
        value = None
    else:
        try:
            value = Decimal(raw["value"])
        except InvalidOperation:
            value = None
    return Observation(date=date.fromisoformat(raw["date"]), value=value)
