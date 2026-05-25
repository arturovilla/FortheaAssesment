"""POST /uploads/initiate, PUT /uploads/{id}/blob, POST /uploads/{id}/commit,
GET /uploads/{id} — the async ingest lifecycle (Part 2 §2.2).

In prod the PUT-blob endpoint does NOT exist on this service. Clients upload
directly to a real presigned URL handed out by /initiate. The PUT endpoint
here exists only because the local "filesystem storage" backend can't issue
real out-of-band URLs.

Every endpoint checks the upload belongs to the request's active tenant —
the upload_id alone is not authorization.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import current_tenant
from app.db.session import get_tenant_scoped_db
from app.schemas.uploads import (
    CommitResponse,
    InitiateRequest,
    InitiateResponse,
    UploadStatus,
    UploadStatusResponse,
    UploadType,
)
from app.services.ingest import process_upload
from app.services.storage import get_storage

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _load_upload_for_tenant(db: Session, upload_id: UUID, tenant_id: str) -> dict:
    """Fetch the upload row, 404 if missing, 403 if it belongs to another tenant."""
    row = db.execute(
        text("""
            SELECT id, tenant_id, type, status, blob_path, accepted, rejected,
                   error, created_at, processed_at
              FROM uploads
             WHERE id = :id
        """),
        {"id": upload_id},
    ).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")
    if row["tenant_id"] != tenant_id:
        # 404 (not 403) on purpose — don't leak the existence of another tenant's resource.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")
    return dict(row)


# =============================================================================
# POST /uploads/initiate
# =============================================================================

@router.post("/initiate", response_model=InitiateResponse)
def initiate(
    body: InitiateRequest,
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_tenant_scoped_db)],
) -> InitiateResponse:
    upload_id = uuid4()
    storage = get_storage()
    presigned_url = storage.presign_upload(upload_id)

    # Reserve the row in `pending` so the client can PUT to /blob next. The actual
    # bytes are not yet written; blob_path is recorded for the worker to read later.
    db.execute(
        text("""
            INSERT INTO uploads (id, tenant_id, type, status, blob_path)
            VALUES (:id, :tenant_id, :type, 'pending', :blob_path)
        """),
        {
            "id": upload_id,
            "tenant_id": tenant_id,
            "type": body.type.value,
            "blob_path": "",  # filled in by /blob; meaningful only after that.
        },
    )
    db.commit()
    return InitiateResponse(upload_id=upload_id, presigned_url=presigned_url)


# =============================================================================
# PUT /uploads/{id}/blob — local-storage stand-in for a real presigned URL
# =============================================================================

@router.put("/{upload_id}/blob", status_code=status.HTTP_204_NO_CONTENT)
async def upload_blob(
    upload_id: UUID,
    request: Request,
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_tenant_scoped_db)],
) -> None:
    row = _load_upload_for_tenant(db, upload_id, tenant_id)
    if row["status"] != UploadStatus.pending.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot upload bytes for an upload in status {row['status']!r}.",
        )

    storage = get_storage()
    body = await request.body()
    if not body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body is empty.",
        )
    blob_path = storage.write_bytes(upload_id, body)
    db.execute(
        text("UPDATE uploads SET blob_path = :blob_path WHERE id = :id"),
        {"id": upload_id, "blob_path": blob_path},
    )
    db.commit()


# =============================================================================
# POST /uploads/{id}/commit — kick off the worker
# =============================================================================

@router.post(
    "/{upload_id}/commit",
    response_model=CommitResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def commit(
    upload_id: UUID,
    background_tasks: BackgroundTasks,
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_tenant_scoped_db)],
) -> CommitResponse:
    row = _load_upload_for_tenant(db, upload_id, tenant_id)
    if row["status"] != UploadStatus.pending.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Upload is already in status {row['status']!r}.",
        )
    if not row["blob_path"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No bytes uploaded yet; PUT /uploads/{id}/blob before commit.",
        )

    # Flip to `processing` synchronously so a status poll immediately reflects intent.
    db.execute(
        text("UPDATE uploads SET status = 'processing' WHERE id = :id"),
        {"id": upload_id},
    )
    db.commit()

    # Production swap: trigger an Airflow DAG run instead, with the upload_id as conf.
    background_tasks.add_task(process_upload, upload_id)
    return CommitResponse(upload_id=upload_id, status=UploadStatus.processing)


# =============================================================================
# GET /uploads/{id} — status polling
# =============================================================================

@router.get("/{upload_id}", response_model=UploadStatusResponse)
def get_status(
    upload_id: UUID,
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_tenant_scoped_db)],
) -> UploadStatusResponse:
    row = _load_upload_for_tenant(db, upload_id, tenant_id)
    return UploadStatusResponse(
        upload_id=row["id"],
        type=UploadType(row["type"]),
        status=UploadStatus(row["status"]),
        accepted=row["accepted"],
        rejected=row["rejected"],
        error=row["error"],
        created_at=row["created_at"],
        processed_at=row["processed_at"],
    )
