# Data Generator

## 1. Why this exists

**Decision:** Build a synthetic data generator producing records that match the brief's three schemas (Google Ads, Meta Ads, Client Table).

**Why this is required, not optional:**

- Neither the Google Ads API nor the Meta Marketing API returns real campaign data without a live, spending ad account.
- A take-home assessment can't reasonably require either.

The generator fills the gap so the FastAPI service (Part 2), the dashboard (Part 4), and the Part 3 §9 / §10 SQL all have something to operate on. The product code never knows the data is synthetic; every stage from ingestion through marts to dashboard treats it as real.

## 2. What it produces

Four JSON outputs per run, organised by tenant:

- `tenants.json` (at the output root): the operational `tenants` registry (Apple, Google, Disney). FK target every tenant-scoped table references.
- `<tenant>/clients.json`: one `dim_client` row per campaign mapping (4 Google + 3 Meta per tenant).
- `<tenant>/google_ads.json`: one `stg_google_ads` row per campaign per day.
- `<tenant>/meta.json`: one `stg_meta_ads` row per DMA-campaign per day.

The per-tenant folders (apple, google, disney) match the three `type` options in the dashboard's upload dialog (`clients`, `google_ads`, `meta`), so the demo flow is "sign in as tenant X, upload its three files in that order".

**CLI flags:**

- `--seed` (default `42`): RNG seed; same seed produces the same dataset.
- `--days` (default `90`): window length per tenant, ending today.
- `--anomaly-rate` (default `0.02`): fraction of campaign-days with injected anomalies.
- `--output-dir` (default `output`): where to write JSON files.
- `--clean / --no-clean` (default on): wipe `output_dir` before writing so re-runs don't merge into stale state.

The tenant list (apple, google, disney), Google campaign count (4 per tenant), Meta campaign count (3 per tenant), and DMA pool (12 representative Nielsen DMAs) are hardcoded constants so the dataset is structurally stable across runs.

The generator only writes files. Loading into Postgres happens through `load.py` (§7).

## 3. Staging-grain output, not marts directly

**Decision:** Generate at the **staging grain**. Marts are derived from staging by the Part 3 §9 SQL.

- **The §9 and §10 SQL is a deliverable.** It demonstrates the data engineering work. Generating marts directly means that SQL never runs.
- **Consistent marts are harder to fake.** To produce `cpa = spend / conversions` rows that add up, the generator would have to invent the spend and conversion totals first. Generating at staging and deriving with SQL is shorter and provably correct.
- **Anomaly injection belongs at the source.** A spend spike or zero-conversion day is staged at the campaign-day grain; the §10 anomaly SQL then *detects* it. That's how the SQL is shown to work.
- **Local mirrors production.** Source → staging → marts in both. Generating at staging keeps the two paths identical.

**Alternative considered: generate marts directly.** Faster setup, no SQL needed for the demo. Loses every property above; the SQL becomes decorative instead of exercised.

## 4. FRED over Census

**Decision:** FRED for the Part 4 enrichment layer.

- **FRED is time-series; Census is cross-sectional.** A FRED series is dated observations (unemployment, CPI, retail sales, consumer sentiment) that line up on the same x-axis as the dashboard's daily marketing KPIs. Census is mostly snapshot demographic counts by geography, and doesn't slot in alongside a time series.
- **The enrichment story is macro context.** The scoping decision frames the external API as economic context blended next to the marketing KPIs. FRED supplies exactly that. Census doesn't answer "what was the economy doing this week?"
- **Equivalent friction.** Both: free API key, JSON responses, no review process. Choice is about fit, not effort.

**Alternative considered: US Census.** Would win if the dashboard's enrichment story were geographic (population by metro, demographics by ZIP). It isn't.

## 5. Realistic synthetic data

Random data exposes every shortcut: negative spend, zero impressions with thousands of clicks, a CPA that flips sign. The generator enforces realism so the demo is defensible.

- **Funnel math.** `impressions ≥ clicks ≥ conversions`. CTR baselines are per tenant (2.8% / 3.8% / 4.5% for google / disney / apple) with ±30% jitter; CVR baselines are 5.5% / 7.2% / 8.5% with the same jitter.
- **Spend math.** `spend = clicks × cpc`. CPC is a per-tenant baseline ($1.80 / $2.50 / $3.20 for disney / apple / google) with ±15% jitter.
- **Per-tenant baselines.** Each tenant has a stable performance profile (better/worse CPA, varying volume). Comparing tenants in the dashboard is meaningful, not noise.
- **Weekly seasonality.** Weekday volumes get a small lift (×1.05) and weekends a small dip (×0.85); otherwise day-to-day variance is pure jitter.
- **DMA distribution for Meta.** Each Meta campaign targets a stable random subset of DMAs (3 to 7 of the 12 in the catalogue), not all of them.
- **Injected anomalies.** A configurable fraction of campaign-days carry deliberate problems. The generator injects two kinds: a spend spike (3.5x to 5x the day's normal spend) or a zero-conversion day (Google Ads `conversions = 0`, Meta `results = 0`). The Part 3 §10 anomaly SQL detects these as `spend_spike` and `zero_conversions`. ROAS collapses and CPA spikes are emergent effects of zero-conversions-with-spend, not separate injections, and the SQL catches those as `roas_collapse` and `cpa_spike`.

## 6. Determinism

**Decision:** Seed-driven. Same seed → same dataset, run after run.

- Tests have stable expected outputs.
- A reviewer running the repo sees the same demo this document describes.
- Bug reports are reproducible.

## 7. How it integrates

The generator and loader are two separate tools that share the same on-disk JSON.

| Use | Path |
|-----|------|
| Quick demo | `datagen.py` writes JSON; `load.py` bulk-inserts every tenant's data directly into Postgres in one transaction. Fully populated dashboard in seconds. |
| Upload-flow demo | `datagen.py` writes JSON; `load.py --bootstrap` seeds only the `tenants` row (the FK target); the reviewer uploads each tenant's three files through the dashboard's **Upload data** button, exercising the full async ingest path (Part 2 §2.2). |
| Marts and anomalies | The mart views (`mart_client_daily_performance`, `mart_client_daily_anomalies`) built by alembic migration 0002 query the staging tables on every read; the Part 3 §10 anomaly SQL runs as part of the views. |
| FRED data | Not generated; fetched live by the backend through `GET /macro`, cached for an hour. |

## 8. Local-dev vs production

The generator runs in both environments, with one difference:

- **Local:** the generator is the **only** source of marketing data. Without it, the dashboard has nothing to show.
- **Production:** the generator is not in the live data path. Real Google Ads and Meta data flow from the actual APIs through the Part 3 pipeline. The generator remains useful for development, integration tests, and demo environments. Same data shape → any code that handles real data also handles generated data without change.

The assessment exercises this line: a system that **would** run on real data, demonstrated end to end with synthetic data the production code cannot tell apart.
