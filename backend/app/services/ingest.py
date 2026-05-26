"""Ingest worker — runs after /commit.

Reads the blob, validates each row against the per-type Pydantic model,
bulk-inserts the valid rows into the matching staging table, records counts
and any error onto the uploads row.

Runs via FastAPI `BackgroundTasks` for local dev — same process as the API,
non-blocking for the request. In production this same logic runs inside an
Airflow task (Part 1 §3, Part 2 §2.2); the swap is one function call at the
/commit handler, not a rewrite of this module.

Failures are recorded, not raised — the worker never crashes. If validation
fails for all rows, status becomes 'failed' with the first error in the
`error` column. If some rows fail and some succeed, status is 'succeeded'
with rejected > 0 and the error column summarises.

Tenant context: the FastAPI app connects as `forthea_app` (RLS-subject,
migration 0004), so the worker MUST set `app.current_tenant` before any
DB op or every SELECT / INSERT silently returns / inserts zero rows. The
tenant is passed in by the commit handler — we can't read it off the
uploads row first because the SELECT would itself be filtered out by RLS.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas.uploads import INGEST_MODELS, INGEST_TABLES, UploadType
from app.services.storage import get_storage

# When inserting Pydantic-validated records into staging tables, drop the
# payload's tenant_id and substitute the upload-row tenant_id (Part 2 §3).
# `loaded_at` is set by the DB default.
_PAYLOAD_FIELDS_TO_DROP = {"tenant_id"}


def _set_tenant(session: Session, tenant_id: str) -> None:
    """Arm RLS for this session's transaction. `set_config(..., true)` =
    transaction-local, so the GUC clears on commit/rollback and never leaks
    onto a pooled connection used by the next request."""
    session.execute(
        text("SELECT set_config('app.current_tenant', :tenant, true)"),
        {"tenant": tenant_id},
    )


def process_upload(upload_id: UUID, tenant_id: str) -> None:
    """Entry point invoked by FastAPI BackgroundTasks after /commit returns 202.

    `tenant_id` is passed in (not read from the uploads row) because the very
    read of that row is RLS-protected — we need the GUC armed first.
    """
    storage = get_storage()
    session = SessionLocal()
    try:
        _set_tenant(session, tenant_id)

        row = session.execute(
            text("SELECT id, tenant_id, type, blob_path FROM uploads WHERE id = :id FOR UPDATE"),
            {"id": upload_id},
        ).mappings().one_or_none()
        if row is None:
            return  # commit handler should have validated this, but be defensive.

        upload_type = UploadType(row["type"])
        blob_path = row["blob_path"]

        try:
            raw = storage.read_bytes(blob_path)
            records = json.loads(raw)
            if not isinstance(records, list):
                raise ValueError("Upload body must be a JSON array of records.")
        except (OSError, json.JSONDecodeError, ValueError) as e:
            _mark_failed(upload_id, tenant_id, f"Could not parse blob: {e}")
            return

        model = INGEST_MODELS[upload_type]
        table = INGEST_TABLES[upload_type]

        accepted_rows: list[dict] = []
        rejected = 0
        first_error: str | None = None
        for index, raw_record in enumerate(records):
            try:
                validated = model.model_validate(raw_record)
            except ValidationError as ve:
                rejected += 1
                if first_error is None:
                    first_error = f"row {index}: {ve.errors(include_url=False)[0]['msg']}"
                continue
            payload = validated.model_dump(mode="json")
            # Substitute server-authoritative tenant_id for the dim_client / staging tables
            # that carry it; ClientRecord has no tenant_id but uses client_id which equals
            # tenant_id in our model.
            for field in _PAYLOAD_FIELDS_TO_DROP:
                payload.pop(field, None)
            if upload_type in (UploadType.google_ads, UploadType.meta):
                payload["tenant_id"] = tenant_id
            elif upload_type == UploadType.clients:
                payload["client_id"] = tenant_id
            accepted_rows.append(payload)

        if accepted_rows:
            _bulk_insert(session, table, accepted_rows)

        terminal_status = "failed" if accepted_rows == [] and rejected > 0 else "succeeded"
        session.execute(
            text("""
                UPDATE uploads
                   SET status = :status,
                       accepted = :accepted,
                       rejected = :rejected,
                       error = :error,
                       processed_at = :processed_at
                 WHERE id = :id
            """),
            {
                "id": upload_id,
                "status": terminal_status,
                "accepted": len(accepted_rows),
                "rejected": rejected,
                "error": first_error,
                "processed_at": datetime.now(timezone.utc),
            },
        )
        session.commit()
    except Exception as e:  # noqa: BLE001  — the worker must never crash silently.
        session.rollback()
        _mark_failed(upload_id, tenant_id, f"Unhandled worker error: {e}")
    finally:
        session.close()


def _mark_failed(upload_id: UUID, tenant_id: str, message: str) -> None:
    """Persist a terminal 'failed' status. Always opens a fresh session because
    we're called from the outer except after the main session has rolled
    back; the new session needs its own tenant GUC for the UPDATE to slip
    past RLS on the uploads table."""
    session = SessionLocal()
    try:
        _set_tenant(session, tenant_id)
        session.execute(
            text("""
                UPDATE uploads
                   SET status = 'failed', error = :error, processed_at = :processed_at
                 WHERE id = :id
            """),
            {"id": upload_id, "error": message, "processed_at": datetime.now(timezone.utc)},
        )
        session.commit()
    finally:
        session.close()


def _bulk_insert(session, table: str, rows: list[dict]) -> None:
    """Generic per-batch INSERT — relies on every row in `rows` having the same keys."""
    columns = list(rows[0].keys())
    statement = text(
        f"INSERT INTO {table} ({', '.join(columns)}) "
        f"VALUES ({', '.join(':' + c for c in columns)})"
    )
    session.execute(statement, rows)
