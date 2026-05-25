"""mart views: client daily performance + anomalies

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-24

Materializes the two marts from Part 3 §9.3 and §10.2 as Postgres VIEWs.

Local dev uses VIEWs (computed on each query) because the data volumes are
small and there's no scheduler to refresh tables. The Part 1 §4 / Part 3 §3
plan for production is the same SQL re-shaped as Snowflake DYNAMIC TABLES
refreshed by Airflow.

Two Snowflake-to-Postgres adaptations from the doc:
  * CREATE OR REPLACE TABLE → CREATE OR REPLACE VIEW
  * FROM VALUES (...) with implicit column1 → FROM (VALUES (...)) AS t(col)
The mart logic itself (joins, window functions, NULLIF guards) is unchanged.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS marts;")

    # ---- mart_client_daily_performance (Part 3 §9.3) ----
    # Daily client-level CPA and ROAS, combining Google Ads + Meta spend.
    # Grain: one row per (client_id, activity_date).
    op.execute("""
        CREATE OR REPLACE VIEW marts.mart_client_daily_performance AS

        WITH
        -- Meta result_type values that count as an acquisition. Only conversion-
        -- style goals are acquisitions for CPA/ROAS.
        meta_conversion_types AS (
            SELECT result_type
            FROM (VALUES ('offsite_conversion'), ('onsite_conversion'), ('lead'))
                 AS t(result_type)
        ),

        -- One row per client. dim_client may hold several campaign-mapping
        -- rows per client (§3.3), so collapse to a distinct client dimension.
        client_dim AS (
            SELECT DISTINCT
                client_id,
                client_name,
                expected_revenue_from_acquisition
            FROM staging.dim_client
        ),

        -- Google Ads: attribute each campaign-day to its client.
        google_daily AS (
            SELECT
                c.client_id,
                g.date           AS activity_date,
                g.spend          AS spend,
                g.conversions    AS conversions
            FROM staging.stg_google_ads g
            JOIN staging.dim_client c
              ON g.campaign_id = c.ga_campaign_id
             AND g.tenant_id   = c.client_id
        ),

        -- Meta: roll DMA rows up to campaign-day, attribute to client, and
        -- count only conversion-type results as conversions.
        meta_daily AS (
            SELECT
                c.client_id,
                m.day            AS activity_date,
                m.spend          AS spend,
                CASE
                    WHEN m.result_type IN (SELECT result_type FROM meta_conversion_types)
                    THEN m.results
                    ELSE 0
                END              AS conversions
            FROM staging.stg_meta_ads m
            JOIN staging.dim_client c
              ON m.campaign_name = c.meta_campaign_name
             AND m.tenant_id     = c.client_id
        ),

        -- Common grain across both platforms.
        combined AS (
            SELECT client_id, activity_date, spend, conversions FROM google_daily
            UNION ALL
            SELECT client_id, activity_date, spend, conversions FROM meta_daily
        ),

        -- Aggregate to client-day.
        client_daily AS (
            SELECT
                client_id,
                activity_date,
                SUM(spend)        AS total_spend,
                SUM(conversions)  AS total_conversions
            FROM combined
            GROUP BY client_id, activity_date
        )

        SELECT
            cd.client_id,
            d.client_name,
            cd.activity_date,
            cd.total_spend,
            cd.total_conversions,
            d.expected_revenue_from_acquisition,
            cd.total_conversions * d.expected_revenue_from_acquisition
                                                      AS total_revenue,
            -- CPA: NULL when there are no conversions (no division by zero).
            cd.total_spend / NULLIF(cd.total_conversions, 0)
                                                      AS cpa,
            -- ROAS: NULL when there is no spend.
            (cd.total_conversions * d.expected_revenue_from_acquisition)
                / NULLIF(cd.total_spend, 0)           AS roas
        FROM client_daily cd
        JOIN client_dim d
          ON cd.client_id = d.client_id;
    """)

    # ---- mart_client_daily_anomalies (Part 3 §10.2) ----
    # Flags anomalies in the daily client-level CPA/ROAS data by comparing
    # each client-day against that client's trailing 28-day history.
    op.execute("""
        CREATE OR REPLACE VIEW marts.mart_client_daily_anomalies AS

        WITH stats AS (
            SELECT
                client_id,
                client_name,
                activity_date,
                total_spend,
                total_conversions,
                cpa,
                roas,
                -- Trailing 28 days, current day excluded.
                AVG(cpa)         OVER w AS cpa_mean,
                STDDEV(cpa)      OVER w AS cpa_std,
                AVG(roas)        OVER w AS roas_mean,
                STDDEV(roas)     OVER w AS roas_std,
                AVG(total_spend) OVER w AS spend_mean
            FROM marts.mart_client_daily_performance
            WINDOW w AS (
                PARTITION BY client_id
                ORDER BY activity_date
                ROWS BETWEEN 28 PRECEDING AND 1 PRECEDING
            )
        ),

        scored AS (
            SELECT
                stats.*,
                (cpa  - cpa_mean)  / NULLIF(cpa_std, 0)  AS cpa_zscore,
                (roas - roas_mean) / NULLIF(roas_std, 0) AS roas_zscore
            FROM stats
        )

        SELECT
            client_id,
            client_name,
            activity_date,
            total_spend,
            total_conversions,
            cpa,
            roas,
            cpa_zscore,
            roas_zscore,
            (total_spend > 0 AND total_conversions = 0) AS is_zero_conversions_with_spend,
            (cpa_zscore  >  3)                          AS is_cpa_spike,
            (roas_zscore < -3)                          AS is_roas_collapse,
            (total_spend > 3 * spend_mean)              AS is_spend_spike
        FROM scored
        WHERE (total_spend > 0 AND total_conversions = 0)
           OR cpa_zscore  >  3
           OR roas_zscore < -3
           OR total_spend > 3 * spend_mean;
    """)


def downgrade() -> None:
    # Drop dependent view first (anomalies reads from performance).
    op.execute("DROP VIEW IF EXISTS marts.mart_client_daily_anomalies;")
    op.execute("DROP VIEW IF EXISTS marts.mart_client_daily_performance;")
    # Only drop the schema if it ends up empty; safer to leave it.
    op.execute("DROP SCHEMA IF EXISTS marts;")
