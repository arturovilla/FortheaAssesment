"""Clerk JWT verification.

Validates the JWT signature against Clerk's JWKS, checks standard time
claims, and pulls `tenant_id` / `tenants` from the token's custom claims
(populated by a Clerk JWT template — see the setup note below).

JWT template setup (one-time, in the Clerk dashboard):

    JWT Templates → + New template → name it `forthea`
    Claims:
        {
          "tenant_id": "{{user.public_metadata.tenant_id}}",
          "tenants":   "{{user.public_metadata.tenants}}",
          "email":     "{{user.primary_email_address.email_address}}"
        }

The frontend then asks Clerk for a token rendered through this template:

    const token = await getToken({ template: "forthea" });

For server-side curl testing, copy a token from the Clerk dashboard's JWT
template debugger (Templates → forthea → "..." → Preview token).
"""

from __future__ import annotations

import json
from functools import lru_cache

import jwt
from fastapi import HTTPException, status
from jwt import InvalidTokenError, PyJWKClient

from app.auth.models import AuthenticatedUser
from app.settings import get_settings


@lru_cache
def _jwks_client() -> PyJWKClient:
    """One JWKS client per process; PyJWKClient caches signing keys internally."""
    settings = get_settings()
    if not settings.clerk_jwks_url:
        raise RuntimeError(
            "CLERK_JWKS_URL is not set. Add it to backend/.env.local — copy from "
            "Clerk dashboard → API keys → Show JWKS URL."
        )
    return PyJWKClient(settings.clerk_jwks_url)


def verify_token(token: str) -> AuthenticatedUser:
    """Verify a Clerk JWT and return the authenticated identity.

    Raises HTTPException(401) for any signature / expiration / structural
    failure. The route handler should not catch this — let it bubble.
    """
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            # Clerk's session JWT does not set `aud`; trust the JWKS we configured.
            options={"verify_aud": False},
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the `sub` claim.",
        )

    return AuthenticatedUser(
        user_id=user_id,
        email=claims.get("email"),
        tenant_id=_str_or_none(claims.get("tenant_id")),
        tenants=_parse_tenants(claims.get("tenants"), claims.get("tenant_id")),
    )


def _str_or_none(value: object) -> str | None:
    """Coerce a claim to str, treating empty values as None."""
    if value is None or value == "":
        return None
    return str(value)


def _parse_tenants(tenants_claim: object, fallback_tenant_id: object) -> list[str]:
    """Normalize the `tenants` claim, which Clerk may render as a list or JSON string.

    Falls back to `[tenant_id]` if `tenants` is empty but `tenant_id` is set —
    so single-tenant users don't need to populate both fields in metadata.
    """
    tenants: list[str] = []
    if isinstance(tenants_claim, list):
        tenants = [str(t) for t in tenants_claim if t]
    elif isinstance(tenants_claim, str) and tenants_claim:
        try:
            parsed = json.loads(tenants_claim)
        except json.JSONDecodeError:
            # Clerk sometimes renders a single value as a plain string, not JSON.
            tenants = [tenants_claim]
        else:
            if isinstance(parsed, list):
                tenants = [str(t) for t in parsed if t]
            elif parsed:
                tenants = [str(parsed)]

    if not tenants and fallback_tenant_id:
        tenants = [str(fallback_tenant_id)]
    return tenants
