"""
datagen.py — generate deterministic synthetic data for the Forthea demo.

Produces TWO sets of JSON files in one run:

  output/seed/    — used by load.py to seed the database:
      tenants.json          → operational `tenants` rows
      dim_client.json       → staging `dim_client` (campaign-to-client mapping)
      stg_google_ads.json   → staging `stg_google_ads` (90 days of history)
      stg_meta_ads.json     → staging `stg_meta_ads`   (90 days of history)

  output/ingest/  — used to test the FastAPI JSON ingest endpoints later:
      google_ads.json       → 1 day of fresh data (today)
      meta.json             → 1 day of fresh data (today)
      clients.json          → a few additional campaign-to-client mappings

The seed set is "history already in the warehouse." The ingest set is "new data
arriving via the API." Together they exercise both the loader and the
upload-ingest path.

Always produces data for three tenants: apple, google, disney. Tenant IDs are
slug strings (not UUIDs) so they match Clerk's `publicMetadata`.

Run:
    python datagen.py                          # defaults: seed 42, 90 days of history
    python datagen.py --seed 7 --days 30       # 30 days, different seed
    python datagen.py --output-dir /tmp/data   # custom output directory
"""

from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable

import typer

# =============================================================================
# Constants — the deterministic shape of the demo
# =============================================================================

# Tenant IDs are slugs that must match Clerk's publicMetadata.tenant_id.
# Tenant display name is shown in the dashboard.
TENANTS: list[dict[str, str]] = [
    {"id": "apple",  "name": "Apple"},
    {"id": "google", "name": "Google"},
    {"id": "disney", "name": "Disney"},
]

# Per-tenant performance baselines. Each tenant has a stable profile so that
# comparing tenants in the dashboard is meaningful, not noise.
#   ctr               — click-through rate (clicks / impressions)
#   cvr               — conversion rate (conversions / clicks)
#   cpc               — cost per click (USD)
#   expected_revenue  — Client Table's expected_revenue_from_acquisition
#   volume            — multiplier on daily impressions (relative size)
TENANT_BASELINES: dict[str, dict[str, float]] = {
    "apple":  {"ctr": 0.045, "cvr": 0.085, "cpc": 2.50, "expected_revenue": 120.00, "volume": 1.3},
    "google": {"ctr": 0.028, "cvr": 0.055, "cpc": 3.20, "expected_revenue":  85.00, "volume": 1.0},
    "disney": {"ctr": 0.038, "cvr": 0.072, "cpc": 1.80, "expected_revenue":  60.00, "volume": 0.7},
}

# Google Ads campaign types from the brief schema
GOOGLE_CAMPAIGN_TYPES: list[str] = ["SEARCH", "DISPLAY", "PERFORMANCE_MAX", "SHOPPING", "VIDEO"]
GOOGLE_CAMPAIGNS_PER_TENANT: int = 4

# Meta campaign names per tenant (just labels; the join key is the name itself).
META_CAMPAIGN_LABELS: list[str] = ["Awareness", "Conversion", "Retention"]
META_CAMPAIGNS_PER_TENANT: int = len(META_CAMPAIGN_LABELS)

# A representative subset of US Nielsen DMAs. Meta's full list is ~210; a campaign
# typically targets a small subset.
META_DMAS: list[str] = [
    "501-New York",
    "803-Los Angeles",
    "602-Chicago",
    "504-Philadelphia",
    "623-Dallas-Ft. Worth",
    "807-San Francisco-Oakland",
    "511-Washington DC",
    "618-Houston",
    "506-Boston",
    "524-Atlanta",
    "539-Tampa-St. Petersburg",
    "528-Miami-Ft. Lauderdale",
]

# Meta result types. Only the conversion-style ones are counted toward CPA/ROAS
# by the Part 3 §9.3 SQL (meta_conversion_types CTE).
META_RESULT_TYPES_CONVERSION: list[str] = ["offsite_conversion", "onsite_conversion", "lead"]
META_RESULT_TYPES_OTHER: list[str] = ["link_click"]
META_RESULT_TYPES_ALL: list[str] = META_RESULT_TYPES_CONVERSION + META_RESULT_TYPES_OTHER

# Output layout
SEED_SUBDIR: str = "seed"
INGEST_SUBDIR: str = "ingest"
INGEST_DAYS: int = 1


# =============================================================================
# Dataclasses — one per output JSON file
# =============================================================================

@dataclass
class TenantRecord:
    """Row in the operational `tenants` table (Part 1 §2.5)."""
    id: str
    name: str


@dataclass
class ClientRecord:
    """Row in `staging.dim_client` (Part 3 §3.3).

    The brief's Client Table has one GA campaign_id and one Meta campaign_name
    per row. We emit multiple rows per tenant — one per campaign mapping — per
    the Part 3 §3.3 "campaign-to-client mapping" interpretation.
    """
    client_id: str
    client_name: str
    ga_campaign_id: str | None
    meta_campaign_name: str | None
    expected_revenue_from_acquisition: float


@dataclass
class GoogleAdsRecord:
    """Row in `staging.stg_google_ads` (Part 3 §3.2)."""
    tenant_id: str
    campaign_id: str
    campaign_type: str
    date: str  # ISO YYYY-MM-DD
    spend: float
    impressions: int
    clicks: int
    conversions: float


@dataclass
class MetaAdsRecord:
    """Row in `staging.stg_meta_ads` (Part 3 §3.2)."""
    tenant_id: str
    campaign_name: str
    dma: str
    day: str  # ISO YYYY-MM-DD
    spend: float
    reach: int
    impressions: int
    clicks: int
    result_type: str
    results: float


# =============================================================================
# Helpers
# =============================================================================

def daterange(start: date, end: date) -> Iterable[date]:
    """Inclusive range from start to end."""
    for i in range((end - start).days + 1):
        yield start + timedelta(days=i)


def jitter(rng: random.Random, base: float, spread: float = 0.2) -> float:
    """Random multiplier around 1.0 with given spread (e.g. 0.2 → ±20%)."""
    return base * rng.uniform(1.0 - spread, 1.0 + spread)


def weekly_seasonality(d: date) -> float:
    """Mild weekend dip / weekday lift. Returns a daily-volume multiplier."""
    return 0.85 if d.weekday() >= 5 else 1.05


def write_json(path: Path, records: list) -> None:
    """Serialize records to a pretty-printed JSON array."""
    path.write_text(json.dumps([asdict(r) for r in records], indent=2, default=str))


# =============================================================================
# Generators — one function per output dataset
# =============================================================================

def build_tenants() -> list[TenantRecord]:
    """One row per tenant for the operational store."""
    return [TenantRecord(id=t["id"], name=t["name"]) for t in TENANTS]


def build_clients() -> tuple[list[ClientRecord], dict[str, list[str]], dict[str, list[str]]]:
    """Build dim_client rows + return campaign-id lookups for the ad generators.

    Returns:
        clients: dim_client rows (one per campaign mapping)
        google_campaigns_by_tenant: tenant_id → list of Google campaign IDs
        meta_campaigns_by_tenant:   tenant_id → list of Meta campaign names
    """
    clients: list[ClientRecord] = []
    google_campaigns: dict[str, list[str]] = {}
    meta_campaigns: dict[str, list[str]] = {}

    for tenant in TENANTS:
        tid = tenant["id"]
        baseline = TENANT_BASELINES[tid]

        # Stable campaign identifiers — deterministic across runs.
        google_ids = [f"GA-{tid}-{i:03d}" for i in range(1, GOOGLE_CAMPAIGNS_PER_TENANT + 1)]
        meta_names = [f"{tenant['name']} - {label}" for label in META_CAMPAIGN_LABELS]

        google_campaigns[tid] = google_ids
        meta_campaigns[tid] = meta_names

        # One dim_client row per Google campaign + one per Meta campaign.
        for ga_id in google_ids:
            clients.append(ClientRecord(
                client_id=tid,
                client_name=tenant["name"],
                ga_campaign_id=ga_id,
                meta_campaign_name=None,
                expected_revenue_from_acquisition=baseline["expected_revenue"],
            ))
        for name in meta_names:
            clients.append(ClientRecord(
                client_id=tid,
                client_name=tenant["name"],
                ga_campaign_id=None,
                meta_campaign_name=name,
                expected_revenue_from_acquisition=baseline["expected_revenue"],
            ))

    return clients, google_campaigns, meta_campaigns


def build_ingest_clients() -> list[ClientRecord]:
    """Additional dim_client mappings for the ingest test set.

    Different campaign IDs/names than the seed so they don't conflict on re-ingest.
    One new Google campaign + one new Meta campaign per tenant = 6 rows total.
    """
    records: list[ClientRecord] = []
    for tenant in TENANTS:
        tid = tenant["id"]
        baseline = TENANT_BASELINES[tid]
        # New Google campaign ID (seed used 001-004; ingest uses 005)
        records.append(ClientRecord(
            client_id=tid,
            client_name=tenant["name"],
            ga_campaign_id=f"GA-{tid}-005",
            meta_campaign_name=None,
            expected_revenue_from_acquisition=baseline["expected_revenue"],
        ))
        # New Meta campaign label (seed used Awareness/Conversion/Retention; ingest uses Brand)
        records.append(ClientRecord(
            client_id=tid,
            client_name=tenant["name"],
            ga_campaign_id=None,
            meta_campaign_name=f"{tenant['name']} - Brand",
            expected_revenue_from_acquisition=baseline["expected_revenue"],
        ))
    return records


def generate_google_ads(
    rng: random.Random,
    google_campaigns_by_tenant: dict[str, list[str]],
    start: date,
    end: date,
    anomaly_rate: float,
) -> list[GoogleAdsRecord]:
    """One row per (campaign, day). Funnel math: impressions ≥ clicks ≥ conversions."""
    records: list[GoogleAdsRecord] = []

    for tid, campaign_ids in google_campaigns_by_tenant.items():
        baseline = TENANT_BASELINES[tid]
        for campaign_id in campaign_ids:
            # Each campaign keeps one type for its lifetime.
            campaign_type = rng.choice(GOOGLE_CAMPAIGN_TYPES)
            for d in daterange(start, end):
                base_impressions = 5_000 * baseline["volume"] * weekly_seasonality(d)
                impressions = int(jitter(rng, base_impressions, 0.25))
                ctr = jitter(rng, baseline["ctr"], 0.30)
                cvr = jitter(rng, baseline["cvr"], 0.30)
                cpc = jitter(rng, baseline["cpc"], 0.15)

                clicks = int(impressions * ctr)
                conversions = round(clicks * cvr, 2)
                spend = round(clicks * cpc, 2)

                # Anomaly injection — small fraction of rows get a deliberate problem
                # for Part 3 §10 anomaly SQL to catch.
                if rng.random() < anomaly_rate:
                    kind = rng.choice(["spend_spike", "zero_conversions"])
                    if kind == "spend_spike":
                        spend = round(spend * rng.uniform(3.5, 5.0), 2)
                    elif kind == "zero_conversions":
                        conversions = 0.0

                records.append(GoogleAdsRecord(
                    tenant_id=tid,
                    campaign_id=campaign_id,
                    campaign_type=campaign_type,
                    date=d.isoformat(),
                    spend=spend,
                    impressions=impressions,
                    clicks=clicks,
                    conversions=conversions,
                ))

    return records


def generate_meta_ads(
    rng: random.Random,
    meta_campaigns_by_tenant: dict[str, list[str]],
    start: date,
    end: date,
    anomaly_rate: float,
) -> list[MetaAdsRecord]:
    """One row per (campaign, DMA, day). Each campaign targets a subset of DMAs."""
    records: list[MetaAdsRecord] = []

    for tid, campaign_names in meta_campaigns_by_tenant.items():
        baseline = TENANT_BASELINES[tid]
        for campaign_name in campaign_names:
            # A campaign targets a stable subset of DMAs (per data-generator doc §5).
            dmas = rng.sample(META_DMAS, k=rng.randint(3, 7))
            # The campaign's optimization goal (result_type) is stable for its lifetime.
            result_type = rng.choice(META_RESULT_TYPES_ALL)

            for d in daterange(start, end):
                for dma in dmas:
                    base_reach = 1_500 * baseline["volume"] * weekly_seasonality(d)
                    reach = int(jitter(rng, base_reach, 0.30))
                    impressions = int(reach * jitter(rng, 1.4, 0.20))  # impressions > reach (frequency)
                    ctr = jitter(rng, baseline["ctr"], 0.30)
                    cvr = jitter(rng, baseline["cvr"], 0.30)
                    cpc = jitter(rng, baseline["cpc"], 0.15)

                    clicks = int(impressions * ctr)
                    spend = round(clicks * cpc, 2)

                    # `results` depends on result_type — only conversion-types are
                    # acquisitions per Part 3 §9.3's `meta_conversion_types` CTE.
                    if result_type in META_RESULT_TYPES_CONVERSION:
                        results = round(clicks * cvr, 2)
                    else:
                        # e.g. link_click: results == clicks
                        results = float(clicks)

                    if rng.random() < anomaly_rate:
                        kind = rng.choice(["spend_spike", "zero_results"])
                        if kind == "spend_spike":
                            spend = round(spend * rng.uniform(3.5, 5.0), 2)
                        elif kind == "zero_results":
                            results = 0.0

                    records.append(MetaAdsRecord(
                        tenant_id=tid,
                        campaign_name=campaign_name,
                        dma=dma,
                        day=d.isoformat(),
                        spend=spend,
                        reach=reach,
                        impressions=impressions,
                        clicks=clicks,
                        result_type=result_type,
                        results=results,
                    ))

    return records


# =============================================================================
# CLI
# =============================================================================

app = typer.Typer(add_completion=False, help="Generate synthetic Forthea data.")


@app.command()
def main(
    seed: int = typer.Option(42, help="RNG seed; same seed → same dataset."),
    days: int = typer.Option(90, help="How many days of history in the seed set."),
    output_dir: Path = typer.Option(Path("output"), help="Where to write JSON files."),
    anomaly_rate: float = typer.Option(0.02, help="Fraction of campaign-days with injected anomalies."),
) -> None:
    """Generate the seed set (history) and the ingest set (test fixtures for the API)."""
    rng = random.Random(seed)
    today = date.today()

    # ---- Seed set: history up to yesterday, used by load.py ----
    seed_start = today - timedelta(days=days)
    seed_end = today - timedelta(days=1)
    seed_dir = output_dir / SEED_SUBDIR
    seed_dir.mkdir(parents=True, exist_ok=True)

    tenants = build_tenants()
    clients, google_campaigns, meta_campaigns = build_clients()
    seed_google = generate_google_ads(rng, google_campaigns, seed_start, seed_end, anomaly_rate)
    seed_meta = generate_meta_ads(rng, meta_campaigns, seed_start, seed_end, anomaly_rate)

    write_json(seed_dir / "tenants.json", tenants)
    write_json(seed_dir / "dim_client.json", clients)
    write_json(seed_dir / "stg_google_ads.json", seed_google)
    write_json(seed_dir / "stg_meta_ads.json", seed_meta)

    # ---- Ingest set: 1 day of fresh data (today), used to test the API ----
    ingest_start = today
    ingest_end = today + timedelta(days=INGEST_DAYS - 1)
    ingest_dir = output_dir / INGEST_SUBDIR
    ingest_dir.mkdir(parents=True, exist_ok=True)

    ingest_google = generate_google_ads(rng, google_campaigns, ingest_start, ingest_end, anomaly_rate)
    ingest_meta = generate_meta_ads(rng, meta_campaigns, ingest_start, ingest_end, anomaly_rate)
    ingest_clients = build_ingest_clients()

    write_json(ingest_dir / "google_ads.json", ingest_google)
    write_json(ingest_dir / "meta.json", ingest_meta)
    write_json(ingest_dir / "clients.json", ingest_clients)

    # ---- Report ----
    typer.echo(f"Seed:         {seed}")
    typer.echo(f"Anomaly rate: {anomaly_rate:.1%}")
    typer.echo(f"Tenants:      {[t['id'] for t in TENANTS]}")
    typer.echo("")
    typer.echo(f"Seed set ({seed_start} → {seed_end}, {days} days):")
    typer.echo(f"  {len(tenants):>6}  seed/tenants.json")
    typer.echo(f"  {len(clients):>6}  seed/dim_client.json")
    typer.echo(f"  {len(seed_google):>6}  seed/stg_google_ads.json")
    typer.echo(f"  {len(seed_meta):>6}  seed/stg_meta_ads.json")
    typer.echo("")
    typer.echo(f"Ingest set ({ingest_start} → {ingest_end}, {INGEST_DAYS} day):")
    typer.echo(f"  {len(ingest_google):>6}  ingest/google_ads.json")
    typer.echo(f"  {len(ingest_meta):>6}  ingest/meta.json")
    typer.echo(f"  {len(ingest_clients):>6}  ingest/clients.json")
    typer.echo("")
    typer.echo(f"→ {output_dir.resolve()}")


if __name__ == "__main__":
    app()
