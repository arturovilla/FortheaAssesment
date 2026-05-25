"""Pydantic response models for the /clients endpoint."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel


class ClientSummary(BaseModel):
    """One row in /clients — the client + campaign-mapping counts.

    Sourced from `staging.dim_client`. In the current model `client_id` is
    identical to `tenant_id`; the field stays separate so the API can
    represent agencies-with-multiple-clients later without a breaking change.
    """

    client_id: str
    client_name: str
    expected_revenue_from_acquisition: Decimal
    google_campaign_count: int
    meta_campaign_count: int


class ClientsResponse(BaseModel):
    """Wrapper to keep the shape consistent with paginated list endpoints."""

    items: list[ClientSummary]
