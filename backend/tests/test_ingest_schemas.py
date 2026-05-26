"""Tests for the Pydantic ingest record schemas in app/schemas/uploads.py.

These validate FR-2.3 / NFR-9 (schema validation before storage): a valid row
parses cleanly, a row missing a required field is rejected, and unknown fields
in the payload are silently dropped instead of failing the whole row.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.uploads import ClientRecord, GoogleAdsRecord, MetaAdsRecord


def test_google_ads_record_accepts_valid_payload():
    record = GoogleAdsRecord(
        tenant_id="apple",
        campaign_id="g-001",
        campaign_type="SEARCH",
        date="2026-05-20",
        spend="123.45",
        impressions=1000,
        clicks=42,
        conversions="3.5",
    )
    assert record.campaign_id == "g-001"
    assert record.date == date(2026, 5, 20)
    assert record.spend == Decimal("123.45")
    assert record.conversions == Decimal("3.5")


def test_google_ads_record_rejects_missing_required_field():
    with pytest.raises(ValidationError):
        GoogleAdsRecord(
            tenant_id="apple",
            # campaign_id missing
            date="2026-05-20",
            spend="100",
            impressions=10,
            clicks=1,
            conversions="0",
        )


def test_google_ads_record_drops_unknown_fields():
    # `extra="ignore"` is intentional (see schemas/uploads.py): benign upstream
    # additions must not fail otherwise-valid rows.
    record = GoogleAdsRecord(
        tenant_id="apple",
        campaign_id="g-001",
        date="2026-05-20",
        spend="100",
        impressions=10,
        clicks=1,
        conversions="0",
        future_field_added_by_google="surprise!",
    )
    assert not hasattr(record, "future_field_added_by_google")


def test_meta_ads_record_accepts_valid_payload():
    record = MetaAdsRecord(
        tenant_id="disney",
        campaign_name="Summer Push",
        dma="New York NY",
        day="2026-05-20",
        spend="500.00",
        reach=10000,
        impressions=20000,
        clicks=350,
        result_type="LEAD",
        results="12",
    )
    assert record.dma == "New York NY"
    assert record.results == Decimal("12")


def test_client_record_accepts_optional_fields_missing():
    # ga_campaign_id and meta_campaign_name are optional — a client mapped to
    # only one ad platform must still parse.
    record = ClientRecord(
        client_id="c-apple",
        client_name="Apple Inc.",
        expected_revenue_from_acquisition="250.00",
    )
    assert record.ga_campaign_id is None
    assert record.meta_campaign_name is None
