"""Pydantic models for the authenticated identity carried per request."""

from __future__ import annotations

from pydantic import BaseModel


class AuthenticatedUser(BaseModel):
    """Decoded identity from a verified Clerk JWT.

    `tenants` is the source of truth for tenant access — single-tenant users
    have one entry, agency staff have several. `tenant_id` is convenience for
    the single-tenant case (identical to `tenants[0]`).
    """

    user_id: str                    # Clerk's `sub` claim
    email: str | None = None
    tenant_id: str | None = None
    tenants: list[str] = []
