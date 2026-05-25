# Data Generator

## 1. Why this exists

**Decision:** Build a synthetic data generator producing records that match the brief's three schemas (Google Ads, Meta Ads, Client Table).

**Why this is required, not optional:**

- Neither the Google Ads API nor the Meta Marketing API returns real campaign data without a live, spending ad account.
- A take-home assessment can't reasonably require either.

The generator fills the gap so the FastAPI service (Part 2), the dashboard (Part 4), and the Part 3 §9 / §10 SQL all have something to operate on. The product code never knows the data is synthetic — every stage from ingestion through marts to dashboard treats it as real.

## 2. What it produces

Three datasets, matching the brief schemas:

- `dim_client` — the Client Table.
- `stg_google_ads` — one row per campaign per day.
- `stg_meta_ads` — one row per DMA-campaign per day.

**Output formats (selectable):**

- **JSON files** for the FastAPI ingest endpoint — exercises the full Part 2 validation and write path.
- **Direct SQL inserts** for seeding Postgres in tests.

**Configurable inputs:**

- `seed`, `start_date`, `end_date`
- `n_clients`, `campaigns_per_client_min/max`
- `anomaly_rate` (fraction of client-days that carry an injected anomaly)

## 3. Staging-grain output, not marts directly

**Decision:** Generate at the **staging grain**. Marts are derived from staging by the Part 3 §9 SQL.

- **The §9 and §10 SQL is a deliverable.** It demonstrates the data engineering work. Generating marts directly means that SQL never runs.
- **Consistent marts are harder to fake.** To produce `cpa = spend / conversions` rows that add up, the generator would have to invent the spend and conversion totals first. Generating at staging and deriving with SQL is shorter and provably correct.
- **Anomaly injection belongs at the source.** A spend spike or zero-conversion day is staged at the campaign-day grain; the §10 anomaly SQL then *detects* it. That's how the SQL is shown to work.
- **Local mirrors production.** Source → staging → marts in both. Generating at staging keeps the two paths identical.

**Alternative considered: generate marts directly.** Faster setup, no SQL needed for the demo. Loses every property above; the SQL becomes decorative instead of exercised.

## 4. FRED over Census

**Decision:** FRED for the Part 4 enrichment layer.

- **FRED is time-series; Census is cross-sectional.** A FRED series is dated observations (unemployment, CPI, retail sales, consumer sentiment) that line up on the same x-axis as the dashboard's daily marketing KPIs. Census is mostly snapshot demographic counts by geography — doesn't slot in alongside a time series.
- **The enrichment story is macro context.** The scoping decision frames the external API as economic context blended next to the marketing KPIs. FRED supplies exactly that. Census doesn't answer "what was the economy doing this week?"
- **Equivalent friction.** Both: free API key, JSON responses, no review process. Choice is about fit, not effort.

**Alternative considered: US Census.** Would win if the dashboard's enrichment story were geographic (population by metro, demographics by ZIP). It isn't.

## 5. Realistic synthetic data

Random data exposes every shortcut: negative spend, zero impressions with thousands of clicks, a CPA that flips sign. The generator enforces realism so the demo is defensible.

- **Funnel math:** `impressions ≥ clicks ≥ conversions`. CTR drawn from 1–5%, CVR from 2–10%.
- **Spend math:** `spend = clicks × cpc`. CPC drawn from a per-platform distribution.
- **Per-client baselines.** Each client has a stable performance profile (better/worse CPA, varying volume). Comparing clients is meaningful, not noise.
- **Per-day trend.** Mild weekly seasonality and slow drift; a 30-day chart looks like real data.
- **DMA distribution for Meta.** Campaigns target a plausible subset of DMAs, not all of them.
- **Injected anomalies.** A small, configurable fraction of client-days carry deliberate problems: spend spikes, zero-conversion days, ROAS collapse. The Part 3 §10 anomaly SQL detects them — that's how we know the SQL works.

## 6. Determinism

**Decision:** Seed-driven. Same seed → same dataset, run after run.

- Tests have stable expected outputs.
- A reviewer running the repo sees the same demo this document describes.
- Bug reports are reproducible.

## 7. How it integrates

| Use | Path |
|-----|------|
| Demo / local dev | Generator writes JSON; loader POSTs to the FastAPI ingest endpoint; normal write path runs. |
| Tests | Generator inserts directly into Postgres, bypassing the API for speed. |
| Marts and anomalies | Built by the §9 and §10 SQL from the staging data the generator produced. |
| FRED data | Not generated; fetched live by the backend, cached. |

## 8. Local-dev vs production

The generator runs in both environments, with one difference:

- **Local:** the generator is the **only** source of marketing data. Without it, the dashboard has nothing to show.
- **Production:** the generator is not in the live data path. Real Google Ads and Meta data flow from the actual APIs through the Part 3 pipeline. The generator remains useful for development, integration tests, and demo environments. Same data shape → any code that handles real data also handles generated data without change.

The assessment exercises this line: a system that **would** run on real data, demonstrated end to end with synthetic data the production code cannot tell apart.
