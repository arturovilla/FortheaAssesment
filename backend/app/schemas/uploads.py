"""Pydantic models for /uploads:

  - The request/response envelopes for the four endpoints
  - The three ingest record schemas (one per `type`) the worker validates
    each row against before inserting

The ingest record schemas mirror the staging tables (Part 3 §3.2) and the
shapes that data-generator/datagen.py emits, so a file from
output/ingest/google_ads.json validates as-is against GoogleAdsRecord.

`tenant_id` rule (Part 2 §3): the ingest record schemas accept tenant_id
as a field (since the data-generator emits it) but the worker IGNORES it
when inserting — the authoritative tenant_id is the one bound to the
`uploads` row at /initiate from the authenticated request.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# =============================================================================
# Endpoint envelopes
# =============================================================================

class UploadType(str, Enum):
    google_ads = "google_ads"
    meta = "meta"
    clients = "clients"


class UploadStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    succeeded = "succeeded"
    failed = "failed"


class InitiateRequest(BaseModel):
    type: UploadType


class InitiateResponse(BaseModel):
    upload_id: UUID
    presigned_url: str


class CommitResponse(BaseModel):
    upload_id: UUID
    status: UploadStatus


class UploadStatusResponse(BaseModel):
    upload_id: UUID
    type: UploadType
    status: UploadStatus
    accepted: int | None = None
    rejected: int | None = None
    error: str | None = None
    created_at: datetime
    processed_at: datetime | None = None


# =============================================================================
# Ingest record schemas (one per type)
# =============================================================================

# `extra="ignore"` so unknown payload fields are dropped silently rather than
# failing the whole row — defensive against benign schema drift in source data.
_INGEST_CONFIG = ConfigDict(extra="ignore")


class GoogleAdsRecord(BaseModel):
    model_config = _INGEST_CONFIG

    tenant_id: str            # accepted but ignored at insert (see module docstring)
    campaign_id: str
    campaign_type: str | None = None
    date: date
    spend: Decimal
    impressions: int
    clicks: int
    conversions: Decimal


class MetaAdsRecord(BaseModel):
    model_config = _INGEST_CONFIG

    tenant_id: str
    campaign_name: str
    dma: str
    day: date
    spend: Decimal
    reach: int
    impressions: int
    clicks: int
    result_type: str
    results: Decimal


class ClientRecord(BaseModel):
    model_config = _INGEST_CONFIG

    client_id: str
    client_name: str
    ga_campaign_id: str | None = None
    meta_campaign_name: str | None = None
    expected_revenue_from_acquisition: Decimal


# Resolve a UploadType to its Pydantic model + destination staging table.
INGEST_MODELS: dict[UploadType, type[BaseModel]] = {
    UploadType.google_ads: GoogleAdsRecord,
    UploadType.meta: MetaAdsRecord,
    UploadType.clients: ClientRecord,
}

INGEST_TABLES: dict[UploadType, str] = {
    UploadType.google_ads: "staging.stg_google_ads",
    UploadType.meta: "staging.stg_meta_ads",
    UploadType.clients: "staging.dim_client",
}
