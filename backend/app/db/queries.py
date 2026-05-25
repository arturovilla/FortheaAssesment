"""Reusable read queries.

Central place for the SQL each read endpoint runs. Keeping queries here
(rather than inlined in routers) means:

  - The SQL is in one searchable place when a schema change forces an edit.
  - Routers stay short and focused on HTTP concerns.
  - Tests can exercise the queries against a test DB without going through HTTP.

All queries take `tenant_id` explicitly. Once RLS is added (follow-up
migration), the explicit filter becomes belt-and-suspenders rather than the
sole defense — RLS enforces it at the row level even if a caller forgets.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.anomalies import AnomalyFlag, AnomalyRow
from app.schemas.clients import ClientSummary
from app.schemas.performance import PerformanceRow

# =============================================================================
# /clients
# =============================================================================

_LIST_CLIENTS_SQL = text("""
    SELECT
        client_id,
        client_name,
        expected_revenue_from_acquisition,
        COUNT(*) FILTER (WHERE ga_campaign_id IS NOT NULL)     AS google_campaign_count,
        COUNT(*) FILTER (WHERE meta_campaign_name IS NOT NULL) AS meta_campaign_count
    FROM staging.dim_client
    WHERE client_id = :tenant_id
    GROUP BY client_id, client_name, expected_revenue_from_acquisition
    ORDER BY client_name
""")


def list_clients(db: Session, tenant_id: str) -> list[ClientSummary]:
    """Return the client(s) belonging to the active tenant, with campaign counts."""
    rows = db.execute(_LIST_CLIENTS_SQL, {"tenant_id": tenant_id}).mappings().all()
    return [ClientSummary.model_validate(dict(row)) for row in rows]


# =============================================================================
# /performance
# =============================================================================

_PERFORMANCE_SELECT = """
    SELECT
        client_id,
        client_name,
        activity_date,
        total_spend,
        total_conversions,
        expected_revenue_from_acquisition,
        total_revenue,
        cpa,
        roas
    FROM marts.mart_client_daily_performance
"""

# Fixed sort so cursor pagination is stable; both columns DESC so the dashboard
# sees newest data first.
_PERFORMANCE_ORDER = "ORDER BY activity_date DESC, client_id DESC"


def list_performance(
    db: Session,
    tenant_id: str,
    start_date: date | None,
    end_date: date | None,
    cursor_date: date | None,
    cursor_client_id: str | None,
    limit: int,
) -> list[PerformanceRow]:
    """One page of client-daily performance rows for the active tenant.

    Fetches `limit + 1` rows so the caller can tell whether there is another
    page without a second round trip — the caller trims the extra row and
    encodes the next cursor from the last visible row.
    """
    # Build WHERE dynamically so optional filters become "absent clauses" rather
    # than "compare-with-NULL" branches that confuse the planner.
    where = ["client_id = :tenant_id"]
    params: dict[str, object] = {"tenant_id": tenant_id}

    if start_date is not None:
        where.append("activity_date >= :start_date")
        params["start_date"] = start_date
    if end_date is not None:
        where.append("activity_date <= :end_date")
        params["end_date"] = end_date
    if cursor_date is not None and cursor_client_id is not None:
        # Tuple comparison: "(date, client) strictly older than the cursor row."
        # Matches the DESC ordering above.
        where.append(
            "(activity_date, client_id) < (:cursor_date, :cursor_client_id)"
        )
        params["cursor_date"] = cursor_date
        params["cursor_client_id"] = cursor_client_id

    sql = text(
        f"{_PERFORMANCE_SELECT}\n"
        f"WHERE {' AND '.join(where)}\n"
        f"{_PERFORMANCE_ORDER}\n"
        f"LIMIT :limit"
    )
    params["limit"] = limit + 1
    rows = db.execute(sql, params).mappings().all()
    return [PerformanceRow.model_validate(dict(row)) for row in rows]


# =============================================================================
# /anomalies
# =============================================================================

_ANOMALIES_SELECT = """
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
        is_zero_conversions_with_spend,
        is_cpa_spike,
        is_roas_collapse,
        is_spend_spike
    FROM marts.mart_client_daily_anomalies
"""

# Map the public flag_type query param to the boolean column in the view.
_FLAG_COLUMN: dict[AnomalyFlag, str] = {
    AnomalyFlag.zero_conversions: "is_zero_conversions_with_spend",
    AnomalyFlag.cpa_spike: "is_cpa_spike",
    AnomalyFlag.roas_collapse: "is_roas_collapse",
    AnomalyFlag.spend_spike: "is_spend_spike",
}


def list_anomalies(
    db: Session,
    tenant_id: str,
    start_date: date | None,
    end_date: date | None,
    flag_type: AnomalyFlag | None,
    cursor_date: date | None,
    cursor_client_id: str | None,
    limit: int,
) -> list[AnomalyRow]:
    """One page of flagged client-days for the active tenant."""
    where = ["client_id = :tenant_id"]
    params: dict[str, object] = {"tenant_id": tenant_id}

    if start_date is not None:
        where.append("activity_date >= :start_date")
        params["start_date"] = start_date
    if end_date is not None:
        where.append("activity_date <= :end_date")
        params["end_date"] = end_date
    if flag_type is not None:
        # Column name comes from a server-controlled mapping, never user input.
        where.append(f"{_FLAG_COLUMN[flag_type]} = TRUE")
    if cursor_date is not None and cursor_client_id is not None:
        where.append(
            "(activity_date, client_id) < (:cursor_date, :cursor_client_id)"
        )
        params["cursor_date"] = cursor_date
        params["cursor_client_id"] = cursor_client_id

    sql = text(
        f"{_ANOMALIES_SELECT}\n"
        f"WHERE {' AND '.join(where)}\n"
        f"ORDER BY activity_date DESC, client_id DESC\n"
        f"LIMIT :limit"
    )
    params["limit"] = limit + 1
    rows = db.execute(sql, params).mappings().all()
    return [AnomalyRow.model_validate(dict(row)) for row in rows]
