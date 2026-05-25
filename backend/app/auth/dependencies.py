"""FastAPI dependencies for authentication and tenant resolution.

Two dependencies, layered:

  current_user(token)        — verifies the bearer token, returns identity
  current_tenant(user, hdr)  — picks the active tenant for this request

Endpoint code uses `current_tenant` for any tenant-scoped query, and
`current_user` for endpoints that need only the caller's identity (e.g. /me).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.clerk import verify_token
from app.auth.models import AuthenticatedUser

# auto_error=True → missing/malformed Authorization header → 403 before our code runs.
_bearer = HTTPBearer(auto_error=True)


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> AuthenticatedUser:
    """Verify the bearer token; return the decoded identity."""
    return verify_token(credentials.credentials)


def current_tenant(
    user: Annotated[AuthenticatedUser, Depends(current_user)],
    x_active_tenant: Annotated[str | None, Header(alias="X-Active-Tenant")] = None,
) -> str:
    """Resolve which tenant the request operates on (Part 2 §6.1).

    Rules:
      - User with exactly one tenant: that's the active tenant. Header ignored.
      - User with multiple tenants: `X-Active-Tenant` header is required and
        must name one of those tenants.
      - User with no tenants: 403.
    """
    if not user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no tenant assignments.",
        )

    if len(user.tenants) == 1:
        return user.tenants[0]

    if not x_active_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Active-Tenant header required for multi-tenant users.",
        )
    if x_active_tenant not in user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User does not have access to tenant {x_active_tenant!r}.",
        )
    return x_active_tenant
