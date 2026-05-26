"""
datagen.py — generate deterministic synthetic data for the Forthea demo.

Output structure (one JSON per upload-ready file, organised by tenant):

    output/
    ├── tenants.json              # operational `tenants` rows (bootstrap)
    ├── apple/
    │   ├── clients.json          # dim_client mappings for Apple
    │   ├── google_ads.json       # 90 days of Google Ads (Apple)
    │   └── meta.json             # 90 days of Meta (Apple)
    ├── google/  (same three files)
    └── disney/  (same three files)

Why this shape (vs the old seed/ingest split):

  - The upload UI binds tenant_id from the authenticated request, so each
    file is naturally tenant-scoped. One folder per tenant = one upload
    session for that tenant.
  - The three files inside a tenant folder match the three upload `type`
    options in the dashboard: clients, google_ads, meta.
  - `tenants.json` lives at the root because the operational `tenants`
    table isn't tenant-scoped — it's the registry the others FK to.

Two paths to populate the DB:

  - Quick:  python load.py                       (bulk-load everything direct)
  - Demo:   python load.py --bootstrap           (just tenants), then upload
            each file through the dashboard's Upload data button.

Always produces data for three tenants: apple, google, disney. Tenant IDs
are slug strings (not UUIDs) so they match Clerk's `publicMetadata.tenants`.

Run:
    python datagen.py                          # defaults: seed 42, 90 days
    python datagen.py --seed 7 --days 30
    python datagen.py --output-dir /tmp/data
"""

from __future__ import annotations

import json
import random
import shutil
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable

import typer

# Default output dir is anchored to this script's location, so the command
# works regardless of CWD. Especially important inside the backend container
# where users invoke it as `docker exec -it forthea-backend python data-generator/datagen.py`.
DEFAULT_OUTPUT_DIR = Path(__file__).parent / "output"

# =============================================================================
# Constants — the deterministic shape of the demo
# =============================================================================

# Tenant IDs are slugs that must match Clerk's publicMetadata.tenants.
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
#   expected_revenue  — dim_client.expected_revenue_from_acquisition
#   volume            — multiplier on daily impressions (relative size)
TENANT_BASELINES: dict[str, dict[str, float]] = {
    "apple":  {"ctr": 0.045, "cvr": 0.085, "cpc": 2.50, "expected_revenue": 120.00, "volume": 1.3},
    "google": {"ctr": 0.028, "cvr": 0.055, "cpc": 3.20, "expected_revenue":  85.00, "volume": 1.0},
    "disney": {"ctr": 0.038, "cvr": 0.072, "cpc": 1.80, "expected_revenue":  60.00, "volume": 0.7},
}

# Google Ads campaign types from the brief schema.
GOOGLE_CAMPAIGN_TYPES: list[str] = ["SEARCH", "DISPLAY", "PERFORMANCE_MAX", "SHOPPING", "VIDEO"]
GOOGLE_CAMPAIGNS_PER_TENANT: int = 4

# Meta campaign names per tenant (just labels; the join key is the name itself).
META_CAMPAIGN_LABELS: list[str] = ["Awareness", "Conversion", "Retention"]

# A representative subset of US Nielsen DMAs. Meta's full list is ~210; a
# campaign typically targets a small subset.
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

# Meta result types. Only the conversion-style ones are counted toward
# CPA/ROAS by the Part 3 §9.3 SQL (meta_conversion_types CTE).
META_RESULT_TYPES_CONVERSION: list[str] = ["offsite_conversion", "onsite_conversion", "lead"]
META_RESULT_TYPES_OTHER: list[str] = ["link_click"]
META_RESULT_TYPES_ALL: list[str] = META_RESULT_TYPES_CONVERSION + META_RESULT_TYPES_OTHER


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
    """Row in `staging.stg_google_ads` (Part 3 §3.2).

    `tenant_id` is included for self-documentation but is ignored by the
    upload worker — the authoritative tenant comes from the authenticated
    request (Part 2 §3 tenant_id rule).
    """
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
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([asdict(r) for r in records], indent=2, default=str))


# =============================================================================
# Per-tenant data builders
# =============================================================================

def build_tenant_clients(tenant: dict[str, str]) -> tuple[
    list[ClientRecord], list[str], list[str]
]:
    """Build dim_client rows for one tenant + return campaign-id lookups.

    Returns:
        clients: dim_client rows for this tenant (1 per campaign mapping)
        google_ids: list of Google Ads campaign IDs for this tenant
        meta_names: list of Meta campaign names for this tenant
    """
    tid = tenant["id"]
    baseline = TENANT_BASELINES[tid]

    # Stable campaign identifiers — deterministic across runs.
    google_ids = [f"GA-{tid}-{i:03d}" for i in range(1, GOOGLE_CAMPAIGNS_PER_TENANT + 1)]
    meta_names = [f"{tenant['name']} - {label}" for label in META_CAMPAIGN_LABELS]

    clients: list[ClientRecord] = []
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

    return clients, google_ids, meta_names


def generate_google_ads_for_tenant(
    rng: random.Random,
    tenant_id: str,
    campaign_ids: list[str],
    start: date,
    end: date,
    anomaly_rate: float,
) -> list[GoogleAdsRecord]:
    """One row per (campaign, day). Funnel math: impressions ≥ clicks ≥ conversions."""
    records: list[GoogleAdsRecord] = []
    baseline = TENANT_BASELINES[tenant_id]

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

            # Anomaly injection — small fraction of rows get a deliberate
            # problem for the Part 3 §10 anomaly SQL to catch.
            if rng.random() < anomaly_rate:
                kind = rng.choice(["spend_spike", "zero_conversions"])
                if kind == "spend_spike":
                    spend = round(spend * rng.uniform(3.5, 5.0), 2)
                elif kind == "zero_conversions":
                    conversions = 0.0

            records.append(GoogleAdsRecord(
                tenant_id=tenant_id,
                campaign_id=campaign_id,
                campaign_type=campaign_type,
                date=d.isoformat(),
                spend=spend,
                impressions=impressions,
                clicks=clicks,
                conversions=conversions,
            ))

    return records


def generate_meta_ads_for_tenant(
    rng: random.Random,
    tenant_id: str,
    campaign_names: list[str],
    start: date,
    end: date,
    anomaly_rate: float,
) -> list[MetaAdsRecord]:
    """One row per (campaign, DMA, day). Each campaign targets a stable DMA subset."""
    records: list[MetaAdsRecord] = []
    baseline = TENANT_BASELINES[tenant_id]

    for campaign_name in campaign_names:
        # A campaign targets a stable subset of DMAs.
        dmas = rng.sample(META_DMAS, k=rng.randint(3, 7))
        # The campaign's optimisation goal (result_type) is stable for its lifetime.
        result_type = rng.choice(META_RESULT_TYPES_ALL)

        for d in daterange(start, end):
            for dma in dmas:
                base_reach = 1_500 * baseline["volume"] * weekly_seasonality(d)
                reach = int(jitter(rng, base_reach, 0.30))
                # impressions > reach (frequency).
                impressions = int(reach * jitter(rng, 1.4, 0.20))
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
                    tenant_id=tenant_id,
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
    days: int = typer.Option(90, help="How many days of history to generate per tenant."),
    output_dir: Path = typer.Option(DEFAULT_OUTPUT_DIR, help="Where to write JSON files."),
    anomaly_rate: float = typer.Option(0.02, help="Fraction of campaign-days with injected anomalies."),
    clean: bool = typer.Option(True, "--clean/--no-clean", help="Wipe output_dir before writing."),
) -> None:
    """Generate per-tenant JSON files ready to be uploaded via the dashboard."""
    rng = random.Random(seed)
    today = date.today()
    start = today - timedelta(days=days - 1)
    end = today

    # Wipe contents but NOT the directory itself — when running inside the
    # backend container, `output/` is a bind mount from the host, and
    # deleting the mount point raises EBUSY.
    output_dir.mkdir(parents=True, exist_ok=True)
    if clean:
        for item in output_dir.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()

    # Operational tenants registry (bootstrap, FK target for everything else).
    tenants = [TenantRecord(id=t["id"], name=t["name"]) for t in TENANTS]
    write_json(output_dir / "tenants.json", tenants)

    counts: list[tuple[str, int, int, int]] = []
    for tenant in TENANTS:
        tid = tenant["id"]
        clients, google_ids, meta_names = build_tenant_clients(tenant)
        google_rows = generate_google_ads_for_tenant(
            rng, tid, google_ids, start, end, anomaly_rate,
        )
        meta_rows = generate_meta_ads_for_tenant(
            rng, tid, meta_names, start, end, anomaly_rate,
        )

        tenant_dir = output_dir / tid
        write_json(tenant_dir / "clients.json", clients)
        write_json(tenant_dir / "google_ads.json", google_rows)
        write_json(tenant_dir / "meta.json", meta_rows)

        counts.append((tid, len(clients), len(google_rows), len(meta_rows)))

    # Report
    typer.echo(f"Seed:         {seed}")
    typer.echo(f"Anomaly rate: {anomaly_rate:.1%}")
    typer.echo(f"Window:       {start} → {end} ({days} days)")
    typer.echo("")
    typer.echo(f"{len(tenants):>6}  tenants.json")
    typer.echo("")
    typer.echo(f"  {'tenant':<8}  {'clients':>8}  {'google_ads':>10}  {'meta':>8}")
    typer.echo(f"  {'-' * 8}  {'-' * 8}  {'-' * 10}  {'-' * 8}")
    for tid, n_clients, n_google, n_meta in counts:
        typer.echo(f"  {tid:<8}  {n_clients:>8}  {n_google:>10}  {n_meta:>8}")
    typer.echo("")
    typer.echo(f"→ {output_dir.resolve()}")


if __name__ == "__main__":
    app()
