"""Alembic environment.

Loads DATABASE_URL from backend/.env.local (via python-dotenv) so migrations,
the FastAPI app, and any scripts all share one source of truth for connection
config. `target_metadata` is None for now — autogenerate is not used until the
SQLAlchemy models land in app/models.py.
"""

from __future__ import annotations

import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

# Load .env.local from the backend/ directory (one level up from alembic/).
# .env.local is preferred over .env per the .gitignore convention.
BACKEND_DIR = Path(__file__).resolve().parent.parent
for candidate in (".env.local", ".env"):
    env_path = BACKEND_DIR / candidate
    if env_path.exists():
        load_dotenv(env_path)
        break

config = context.config

# Migrations run DDL (CREATE TABLE, CREATE ROLE, etc.) — that needs superuser
# privileges. Prefer ADMIN_DATABASE_URL (forthea) if it's set; fall back to
# DATABASE_URL so a fresh-clone setup works before RLS is in play.
database_url = os.getenv("ADMIN_DATABASE_URL") or os.getenv("DATABASE_URL")
if not database_url:
    raise RuntimeError(
        "Neither ADMIN_DATABASE_URL nor DATABASE_URL is set. Create "
        "backend/.env.local from .env.example and fill in the connection string."
    )
config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# No declarative metadata yet — autogenerate is unavailable until the app's
# SQLAlchemy models exist. Migrations are written by hand for now.
target_metadata = None


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of executing — useful for code review of DDL."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Connect and execute migrations against the live DB."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
