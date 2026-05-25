"""tenant row-level security: forthea_app role + policies + view security_invoker

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-24

Implements the defense-in-depth tenant isolation from Part 2 §6. Layers:

  1. App code passes `WHERE tenant_id = :tenant_id` (the existing query layer).
  2. RLS policies on every tenant-keyed table enforce the same filter at the
     row level — if a query forgets the WHERE clause, RLS still hides other
     tenants' rows.
  3. The session GUC `app.current_tenant` is set per request via
     `SET LOCAL`, scoping the policy to the authenticated tenant.

For RLS to actually apply, the backend must connect as a non-superuser
(superusers and table owners bypass RLS unless FORCE is used — see below).
This migration creates `forthea_app` for that purpose.

  - `forthea` (superuser, table owner): runs migrations and the loader.
                                        Bypasses RLS — trusted infrastructure.
  - `forthea_app` (non-superuser):      the backend FastAPI process.
                                        Subject to RLS.

`FORCE ROW LEVEL SECURITY` is intentionally NOT applied — that would force
even the table owner through RLS, which would break the loader without
per-tenant `SET LOCAL` ceremony. The trade-off: a future migration mis-run
as `forthea` could see cross-tenant data. Acceptable for this demo;
production would split admin/app workloads onto separate accounts and apply
FORCE for stronger guarantees.

Mart views get `security_invoker = true` so they execute with the caller's
privileges (RLS applies to the underlying staging tables when querying the
view) rather than the view definer's (which would silently bypass RLS).
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- 1. Application role ----
    # Plain LOGIN role, no superuser, no BYPASSRLS. Password is dev-only;
    # in prod this user is created by the cloud provider with managed credentials.
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'forthea_app') THEN
                CREATE ROLE forthea_app LOGIN PASSWORD 'forthea_app';
            END IF;
        END
        $$;
    """)
    op.execute("GRANT USAGE ON SCHEMA public, staging, marts TO forthea_app;")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA staging TO forthea_app;")
    op.execute("GRANT SELECT ON ALL TABLES IN SCHEMA marts TO forthea_app;")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants, public.uploads TO forthea_app;")
    # Default privileges so future tables/views created in these schemas auto-inherit grants.
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO forthea_app;")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA marts GRANT SELECT ON TABLES TO forthea_app;")

    # ---- 2. Enable RLS on every tenant-keyed table ----
    for table in (
        "staging.stg_google_ads",
        "staging.stg_meta_ads",
        "staging.dim_client",
        "public.uploads",
    ):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")

    # ---- 3. Tenant-isolation policies ----
    # `current_setting(..., true)` returns NULL when the GUC is not set.
    # NULL = NULL is NULL (falsy), so no rows leak when the app forgets to
    # SET LOCAL the tenant — the safe default is "see nothing".
    op.execute("""
        CREATE POLICY tenant_isolation ON staging.stg_google_ads
            USING (tenant_id = current_setting('app.current_tenant', true));
    """)
    op.execute("""
        CREATE POLICY tenant_isolation ON staging.stg_meta_ads
            USING (tenant_id = current_setting('app.current_tenant', true));
    """)
    # dim_client uses client_id as the tenant key (Part 3 §3.3).
    op.execute("""
        CREATE POLICY tenant_isolation ON staging.dim_client
            USING (client_id = current_setting('app.current_tenant', true));
    """)
    op.execute("""
        CREATE POLICY tenant_isolation ON public.uploads
            USING (tenant_id = current_setting('app.current_tenant', true));
    """)

    # ---- 4. Mart views run with caller's privileges so RLS applies ----
    op.execute("ALTER VIEW marts.mart_client_daily_performance SET (security_invoker = true);")
    op.execute("ALTER VIEW marts.mart_client_daily_anomalies   SET (security_invoker = true);")


def downgrade() -> None:
    op.execute("ALTER VIEW marts.mart_client_daily_anomalies   RESET (security_invoker);")
    op.execute("ALTER VIEW marts.mart_client_daily_performance RESET (security_invoker);")

    for table in (
        "public.uploads",
        "staging.dim_client",
        "staging.stg_meta_ads",
        "staging.stg_google_ads",
    ):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

    # Drop privileges + role. Reassign owned objects first if any default-priv
    # rules picked anything up.
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA marts REVOKE SELECT ON TABLES FROM forthea_app;")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA staging REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM forthea_app;")
    op.execute("REVOKE ALL ON TABLE public.tenants, public.uploads FROM forthea_app;")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA marts FROM forthea_app;")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA staging FROM forthea_app;")
    op.execute("REVOKE USAGE ON SCHEMA public, staging, marts FROM forthea_app;")
    op.execute("DROP ROLE IF EXISTS forthea_app;")
