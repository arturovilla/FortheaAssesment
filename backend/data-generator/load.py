"""
load.py — direct-DB loader for the per-tenant JSON files written by datagen.py.

Two modes:

  python load.py                # Full load: tenants + every tenant's
                                # clients/google_ads/meta. One transaction.

  python load.py --bootstrap    # Just the tenants row, so the FastAPI
                                # upload UI has a valid FK target. Use this
                                # when you want to demo the upload flow
                                # instead of bulk-loading everything.

Loads in FK-safe order:
    tenants → dim_client → stg_google_ads → stg_meta_ads

Idempotent: each pass DELETEs in reverse FK order before re-inserting, all
inside one transaction so a partial run never leaves bad state.

Schema is owned by backend/alembic. Run `alembic upgrade head` from backend/
once before the first load.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import typer


def _resolve_database_url() -> str:
    """Pick a sensible default DB URL based on where the script is running.

    Inside the backend container, `ADMIN_DATABASE_URL` is already set to the
    in-network DB hostname (`db:5432`). Outside the container, fall back to
    `localhost:5432` for host-side runs.

    Strips SQLAlchemy's `+psycopg` dialect prefix when present; the backend
    app uses the SQLAlchemy URL form but `psycopg.connect()` only accepts
    plain `postgresql://` URLs.
    """
    url = os.environ.get(
        "ADMIN_DATABASE_URL",
        "postgresql://forthea:forthea@localhost:5432/forthea",
    )
    return url.replace("postgresql+psycopg://", "postgresql://")


DEFAULT_DATABASE_URL = _resolve_database_url()
# Anchored to this script's location so the command works regardless of CWD,
# especially inside the backend container.
DEFAULT_OUTPUT_DIR = Path(__file__).parent / "output"

# (table, source filename) — the per-tenant payloads, in FK order.
PER_TENANT_FILES: list[tuple[str, str]] = [
    ("staging.dim_client",     "clients.json"),
    ("staging.stg_google_ads", "google_ads.json"),
    ("staging.stg_meta_ads",   "meta.json"),
]

# Reverse FK order for DELETE: every table that FKs to `tenants` must be
# emptied before `tenants` itself, or Postgres rejects the delete. The
# `uploads` table (migration 0003) is metadata about past async uploads —
# clearing it on a re-load is fine; it's just a log.
DELETE_ORDER: list[str] = [
    "staging.stg_meta_ads",
    "staging.stg_google_ads",
    "staging.dim_client",
    "uploads",
    "tenants",
]

app = typer.Typer(add_completion=False, help="Load generated JSON into Postgres.")


# =============================================================================
# Helpers
# =============================================================================

def load_json(path: Path) -> list[dict]:
    if not path.exists():
        typer.secho(f"ERROR: {path} not found. Run `python datagen.py` first.", fg="red", err=True)
        raise typer.Exit(code=1)
    return json.loads(path.read_text())


def _connect(database_url: str):
    try:
        import psycopg
    except ImportError:
        typer.secho(
            "ERROR: psycopg is not installed. `pip install -r ../requirements.txt`.",
            fg="red", err=True,
        )
        raise typer.Exit(code=1)
    typer.echo(f"Connecting → {database_url}")
    return psycopg.connect(database_url, autocommit=False)


def _insert_records(cur, table: str, records: list[dict]) -> int:
    """Bulk INSERT. Returns the number of rows inserted (skip-safe if empty)."""
    if not records:
        return 0
    from psycopg import sql  # local import keeps the file importable without psycopg

    cols = list(records[0].keys())
    stmt = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.SQL(table),
        sql.SQL(", ").join(map(sql.Identifier, cols)),
        sql.SQL(", ").join([sql.Placeholder()] * len(cols)),
    )
    rows = [tuple(r[c] for c in cols) for r in records]
    cur.executemany(stmt, rows)
    return len(rows)


# =============================================================================
# Main load paths
# =============================================================================

def load_full(output_dir: Path, database_url: str) -> None:
    """Tenants + every tenant's clients/google_ads/meta."""
    tenants = load_json(output_dir / "tenants.json")
    tenant_ids = [t["id"] for t in tenants]

    # Pre-flight: every tenant must have a folder + the three expected files.
    missing: list[Path] = []
    for tid in tenant_ids:
        for _, filename in PER_TENANT_FILES:
            p = output_dir / tid / filename
            if not p.exists():
                missing.append(p)
    if missing:
        typer.secho("ERROR: missing per-tenant files:", fg="red", err=True)
        for p in missing:
            typer.secho(f"  {p}", fg="red", err=True)
        typer.secho("Did you forget to run `python datagen.py`?", fg="red", err=True)
        raise typer.Exit(code=1)

    from psycopg import sql

    with _connect(database_url) as conn:
        with conn.cursor() as cur:
            typer.echo("Clearing existing rows (reverse FK order)")
            for table in DELETE_ORDER:
                cur.execute(sql.SQL("DELETE FROM {}").format(sql.SQL(table)))

            typer.echo("Inserting tenants")
            n = _insert_records(cur, "tenants", tenants)
            typer.echo(f"  {n:>6}  tenants")

            typer.echo("Inserting per-tenant data (forward FK order)")
            for tid in tenant_ids:
                typer.echo(f"  [{tid}]")
                for table, filename in PER_TENANT_FILES:
                    records = load_json(output_dir / tid / filename)
                    n = _insert_records(cur, table, records)
                    typer.echo(f"    {n:>6}  {table}")

        conn.commit()

    typer.secho("Done.", fg="green")


def load_bootstrap(output_dir: Path, database_url: str) -> None:
    """Just the tenants registry — leaves the marketing data to the upload UI."""
    tenants = load_json(output_dir / "tenants.json")

    from psycopg import sql

    with _connect(database_url) as conn:
        with conn.cursor() as cur:
            typer.echo("Clearing existing rows (reverse FK order)")
            for table in DELETE_ORDER:
                cur.execute(sql.SQL("DELETE FROM {}").format(sql.SQL(table)))

            typer.echo("Inserting tenants")
            n = _insert_records(cur, "tenants", tenants)
            typer.echo(f"  {n:>6}  tenants")
        conn.commit()

    typer.secho("Bootstrap done — tenants seeded.", fg="green")
    typer.echo("Next: sign in to the dashboard and upload each tenant's JSON via")
    typer.echo("the 'Upload data' button. Files live under output/<tenant>/.")


# =============================================================================
# CLI
# =============================================================================

@app.command()
def main(
    bootstrap: bool = typer.Option(
        False,
        "--bootstrap",
        help="Load only the tenants row (the FK target). Skip per-tenant data so it can come in via the dashboard upload UI.",
    ),
    output_dir: Path = typer.Option(DEFAULT_OUTPUT_DIR, help="Directory holding the generated JSON."),
    database_url: str = typer.Option(DEFAULT_DATABASE_URL, help="Postgres connection URL."),
) -> None:
    """Direct-DB loader for the per-tenant JSON files written by datagen.py."""
    if bootstrap:
        load_bootstrap(output_dir, database_url)
    else:
        load_full(output_dir, database_url)


if __name__ == "__main__":
    app()
