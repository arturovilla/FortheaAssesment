"""
load.py — load generated JSON into Postgres or via the FastAPI ingest API.

Two modes:
  --target db  (default): direct bulk INSERT into Postgres staging tables.
  --target api          : POSTs through FastAPI ingest endpoints (real
                          validation path; requires the backend to be running).

Loads in dependency order so foreign keys hold:
    tenants → dim_client → stg_google_ads → stg_meta_ads

Idempotent: existing rows are DELETEd in reverse order before re-inserting,
all inside a single transaction so a partial run never leaves bad state.

Schema is owned by backend/alembic. Run `alembic upgrade head` from backend/
once before the first load.

Run:
    python load.py                                                  # Mode B, default localhost DB
    python load.py --database-url postgresql://user:pw@host:5432/db # explicit DB URL
    python load.py --target api --base-url http://localhost:8000    # Mode A (when backend exists)
"""

from __future__ import annotations

import json
from pathlib import Path

import typer

DEFAULT_DATABASE_URL = "postgresql://forthea:forthea@localhost:5432/forthea"
# datagen.py writes two sets: output/seed/ (history, loaded here) and
# output/ingest/ (1-day fresh fixtures for testing the API path later).
DEFAULT_OUTPUT_DIR = Path("output/seed")
DEFAULT_API_BASE_URL = "http://localhost:8000"

# (filename, target table, api type) — order matters for FK satisfaction.
LOAD_ORDER: list[tuple[str, str, str | None]] = [
    ("tenants.json",        "tenants",                 None),
    ("dim_client.json",     "staging.dim_client",      "clients"),
    ("stg_google_ads.json", "staging.stg_google_ads",  "google_ads"),
    ("stg_meta_ads.json",   "staging.stg_meta_ads",    "meta"),
]

app = typer.Typer(add_completion=False, help="Load generated JSON into Postgres or via the API.")


# =============================================================================
# Helpers
# =============================================================================

def load_json(path: Path) -> list[dict]:
    if not path.exists():
        typer.secho(f"ERROR: {path} not found. Run `python datagen.py` first.", fg="red", err=True)
        raise typer.Exit(code=1)
    return json.loads(path.read_text())


# =============================================================================
# Mode B: direct DB insert
# =============================================================================

def load_to_db(output_dir: Path, database_url: str) -> None:
    try:
        import psycopg
        from psycopg import sql
    except ImportError:
        typer.secho(
            "ERROR: psycopg is not installed. Add `psycopg[binary]` to requirements.txt and reinstall.",
            fg="red", err=True,
        )
        raise typer.Exit(code=1)

    typer.echo(f"Connecting → {database_url}")
    with psycopg.connect(database_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            # Delete in reverse FK order so the DELETEs respect references.
            typer.echo("Clearing existing rows (reverse FK order)")
            for _, table, _ in reversed(LOAD_ORDER):
                cur.execute(sql.SQL("DELETE FROM {}").format(sql.SQL(table)))

            # Insert in forward FK order.
            typer.echo("Inserting fresh rows (forward FK order)")
            for filename, table, _ in LOAD_ORDER:
                records = load_json(output_dir / filename)
                if not records:
                    typer.echo(f"  {0:>6}  {table}  (empty)")
                    continue
                cols = list(records[0].keys())
                stmt = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                    sql.SQL(table),
                    sql.SQL(", ").join(map(sql.Identifier, cols)),
                    sql.SQL(", ").join([sql.Placeholder()] * len(cols)),
                )
                rows = [tuple(r[c] for c in cols) for r in records]
                cur.executemany(stmt, rows)
                typer.echo(f"  {len(rows):>6}  {table}")

        conn.commit()

    typer.secho("Done.", fg="green")


# =============================================================================
# Mode A: via FastAPI (placeholder — backend not built yet)
# =============================================================================

def load_to_api(output_dir: Path, base_url: str) -> None:
    typer.secho(
        "Mode A (--target api) is not yet implemented; the FastAPI backend is not built.\n"
        "Use --target db for now. Once the backend exists, this mode will:\n"
        "  1. POST /uploads/initiate with {type: ...} → upload_id + presigned_url\n"
        "  2. PUT the JSON file to the presigned_url\n"
        "  3. POST /uploads/{upload_id}/commit\n"
        "  4. Poll GET /uploads/{upload_id} until succeeded/failed",
        fg="yellow", err=True,
    )
    raise typer.Exit(code=1)


# =============================================================================
# CLI
# =============================================================================

@app.command()
def main(
    target: str = typer.Option("db", help="Where to load: 'db' (direct Postgres) or 'api' (FastAPI)."),
    output_dir: Path = typer.Option(DEFAULT_OUTPUT_DIR, help="Directory holding the generated JSON."),
    database_url: str = typer.Option(DEFAULT_DATABASE_URL, help="Postgres connection URL (used for --target db)."),
    base_url: str = typer.Option(DEFAULT_API_BASE_URL, help="FastAPI base URL (used for --target api)."),
) -> None:
    """Load generated JSON into Postgres or via the FastAPI ingest endpoints.

    Schema must already exist. Run `alembic upgrade head` from backend/ once
    before the first load.
    """
    if target == "db":
        load_to_db(output_dir, database_url)
    elif target == "api":
        load_to_api(output_dir, base_url)
    else:
        typer.secho(f"ERROR: --target must be 'db' or 'api', got {target!r}", fg="red", err=True)
        raise typer.Exit(code=2)


if __name__ == "__main__":
    app()
