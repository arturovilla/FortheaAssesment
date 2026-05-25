"""GET /me — proves the auth wiring end to end.

Returns whatever the verified JWT says about you, plus the tenant the
request would operate on. Useful as a smoke test before building any
tenant-scoped business endpoint on top of `current_tenant`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import current_tenant, current_user
from app.auth.models import AuthenticatedUser

router = APIRouter(tags=["auth"])


@router.get("/me")
def me(
    user: Annotated[AuthenticatedUser, Depends(current_user)],
    tenant_id: Annotated[str, Depends(current_tenant)],
) -> dict:
    return {
        "user_id": user.user_id,
        "email": user.email,
        "active_tenant": tenant_id,
        "available_tenants": user.tenants,
    }
