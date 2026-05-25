"""Blob storage abstraction.

Two implementations behind one interface:

  - LocalFilesystemStorage (BLOB_STORAGE_TYPE=local, dev default)
      Files live at BLOB_STORAGE_PATH/<upload_id>.bin. The "presigned URL"
      we return is a backend endpoint (PUT /uploads/{id}/blob) — there is
      no real out-of-band upload destination on disk.

  - AzureBlobStorage (BLOB_STORAGE_TYPE=azure, prod)
      Stubbed; would use the Azure Storage SDK to generate a real
      time-limited SAS URL the client can PUT to directly, bypassing the
      backend entirely.

The interface intentionally hides the difference so route handlers and the
ingest worker call `storage.write_bytes`, `storage.read_bytes`, and
`storage.presign_upload` without knowing which backend is in play.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from uuid import UUID

from app.settings import get_settings


class BlobStorage(ABC):
    @abstractmethod
    def presign_upload(self, upload_id: UUID) -> str:
        """Return a URL the client uses to PUT the upload's bytes."""

    @abstractmethod
    def write_bytes(self, upload_id: UUID, body: bytes) -> str:
        """Write the upload's bytes; return the blob path stored on the uploads row."""

    @abstractmethod
    def read_bytes(self, blob_path: str) -> bytes:
        """Read previously-written bytes for a given blob path."""


class LocalFilesystemStorage(BlobStorage):
    """Writes to BLOB_STORAGE_PATH; "presigned URL" is the backend's own blob endpoint."""

    def __init__(self, root: Path, public_base: str) -> None:
        self.root = root
        self.public_base = public_base.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def presign_upload(self, upload_id: UUID) -> str:
        # Production swap: this would be an Azure Blob SAS URL with a 15-min TTL.
        return f"{self.public_base}/uploads/{upload_id}/blob"

    def write_bytes(self, upload_id: UUID, body: bytes) -> str:
        path = self.root / f"{upload_id}.bin"
        path.write_bytes(body)
        return str(path)

    def read_bytes(self, blob_path: str) -> bytes:
        return Path(blob_path).read_bytes()


@lru_cache
def get_storage() -> BlobStorage:
    settings = get_settings()
    if settings.blob_storage_type == "local":
        # Dev backend URL — fine for local; the prod equivalent goes through Azure.
        return LocalFilesystemStorage(
            root=Path(settings.blob_storage_path),
            public_base="http://localhost:8000",
        )
    raise NotImplementedError(
        f"Blob storage type {settings.blob_storage_type!r} is not implemented yet. "
        "Add an AzureBlobStorage class using azure-storage-blob's generate_blob_sas."
    )
