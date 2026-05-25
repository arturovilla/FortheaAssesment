"""SQLAlchemy engine + per-request session.

The engine is process-wide (one connection pool per worker). Each HTTP
request gets its own short-lived Session via the `get_db` dependency, which
opens it at the start of the request and closes it after the response.

`get_tenant_scoped_db` layers RLS enforcement on top of `get_db` — it runs
`SET LOCAL app.current_tenant = …` on the session so Postgres' RLS policies
(migration 0004) filter every subsequent query to the authenticated tenant.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.auth.dependencies import current_tenant
from app.settings import get_settings

settings = get_settings()

# pool_pre_ping=True silently swaps out connections dropped by Postgres
# restarts or transient network blips; the alternative is one failed request
# per dropped connection.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autocommit=False,
    autoflush=False,
)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: yields a session, closes it after the response."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_tenant_scoped_db(
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_db)],
) -> Session:
    """Variant of `get_db` that sets the RLS session variable first.

    Uses `set_config(name, value, is_local)` rather than literal `SET LOCAL`
    because Postgres' `SET` statement doesn't accept bind parameters. The
    `true` third arg makes it transaction-scoped (equivalent to SET LOCAL),
    so the value auto-clears at commit/rollback — no bleed across requests
    that share a pooled connection.
    """
    db.execute(
        text("SELECT set_config('app.current_tenant', :tenant, true)"),
        {"tenant": tenant_id},
    )
    return db
