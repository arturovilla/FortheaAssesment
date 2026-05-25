"""GET /macro — macroeconomic indicators from FRED (cached).

Macro data is the same for everyone — it doesn't depend on tenant. So the
endpoint requires auth (`current_user`) but skips tenant resolution
(`current_tenant`). The dashboard uses these series for contextual overlays
on the CPA / ROAS charts: "CPA went up, but inflation also went up X%".

Series are picked by friendly key (`inflation`, `unemployment`, ...) defined
in `app.services.fred.SERIES_REGISTRY`. Default = inflation + unemployment.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import current_user
from app.auth.models import AuthenticatedUser
from app.schemas.macro import MacroResponse, MacroSeries
from app.services.fred import SERIES_REGISTRY, fetch_observations

router = APIRouter(tags=["macro"])


@router.get("/macro", response_model=MacroResponse)
def get_macro(
    _user: Annotated[AuthenticatedUser, Depends(current_user)],
    series: Annotated[
        list[str] | None,
        Query(
            description=(
                f"Series keys to fetch. Choices: {sorted(SERIES_REGISTRY)}. "
                "Default = inflation + unemployment."
            ),
        ),
    ] = None,
    start_date: Annotated[date | None, Query(description="FRED observation_start.")] = None,
    end_date: Annotated[date | None, Query(description="FRED observation_end.")] = None,
) -> MacroResponse:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be on or before end_date.",
        )

    keys = series or ["inflation", "unemployment"]
    unknown = [k for k in keys if k not in SERIES_REGISTRY]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown series keys: {unknown}. Choices: {sorted(SERIES_REGISTRY)}.",
        )

    items: list[MacroSeries] = []
    for key in keys:
        series_id, title = SERIES_REGISTRY[key]
        items.append(MacroSeries(
            key=key,
            series_id=series_id,
            title=title,
            observations=fetch_observations(series_id, start_date, end_date),
        ))
    return MacroResponse(items=items)
