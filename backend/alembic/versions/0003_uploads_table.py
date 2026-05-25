"""uploads table: tracks each async ingest from initiate to terminal status

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-24

The uploads table is the single source of truth for an in-flight async
ingest (Part 2 §2.2). The lifecycle is:

  initiate → pending → (client PUTs blob) → processing → succeeded / failed

Each row records:
  - tenant_id: bound at initiate from the authenticated request. NEVER read
               from the uploaded payload — that's the Part 2 §3 rule.
  - type:      one of 'google_ads' | 'meta' | 'clients'. Tells the worker
               which Pydantic model to use at validation time.
  - blob_path: where the bytes live on disk (local) or in cloud storage.
  - accepted / rejected: row counts after the worker runs.
  - error:     last error text on terminal failure.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE uploads (
            id            UUID PRIMARY KEY,
            tenant_id     TEXT NOT NULL REFERENCES tenants(id),
            type          TEXT NOT NULL CHECK (type IN ('google_ads', 'meta', 'clients')),
            status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
            blob_path     TEXT NOT NULL,
            accepted      INTEGER,
            rejected      INTEGER,
            error         TEXT,
            created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
            processed_at  TIMESTAMP
        );
    """)
    # Fast lookup for "list this tenant's recent uploads" in the dashboard.
    op.execute("""
        CREATE INDEX uploads_tenant_created
            ON uploads (tenant_id, created_at DESC);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS uploads;")
