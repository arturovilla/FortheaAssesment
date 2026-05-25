"""Settings — env-driven config via Pydantic Settings.

Reads `backend/.env.local` in dev. In a deployed environment the same vars
come from the platform's secret store (e.g. Kubernetes secrets, AWS SSM)
and the `env_file` path simply doesn't exist, which is fine.

Settings is a singleton via `lru_cache` so import-time validation runs once.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env.local",
        env_file_encoding="utf-8",
        # Allow extra env vars without erroring — useful when shared env files
        # carry frontend-only vars (NEXT_PUBLIC_*) etc.
        extra="ignore",
    )

    # ---- Database ----
    # `database_url`        — non-superuser (forthea_app); RLS applies.
    #                         Used by the FastAPI app at runtime.
    # `admin_database_url`  — superuser   (forthea); bypasses RLS, has DDL.
    #                         Used by alembic for migrations. Falls back to
    #                         `database_url` if not set, which makes a fresh-
    #                         clone setup work before RLS is in play.
    database_url: str
    admin_database_url: str | None = None

    # ---- App ----
    app_env: Literal["local", "dev", "staging", "prod"] = "local"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ---- Auth (Clerk) — required once auth lands ----
    clerk_secret_key: str | None = None
    clerk_jwks_url: str | None = None

    # ---- Enrichment (FRED) — required once /macro lands ----
    fred_api_key: str | None = None

    # ---- Blob storage — required once /uploads lands ----
    blob_storage_type: Literal["local", "azure"] = "local"
    blob_storage_path: str = "/tmp/forthea-blob"

    # ---- CORS ----
    # Comma-separated origins allowed to call the API from the browser.
    # Default = Next.js dev server. Override in .env.local for staging/prod.
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Allow `CORS_ORIGINS=http://a,http://b` in env files (vs JSON-list)."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # pydantic reads from env
