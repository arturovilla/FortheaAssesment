"""GET /clients — the client list for the dashboard's tenant selector.

Returns the client(s) belonging to the request's active tenant. Tenant
resolution is handled by `current_tenant` (Part 2 §6.1) — the route doesn't
read tenant from the path, query, or body.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import current_tenant
from app.db import queries
from app.db.session import get_tenant_scoped_db
from app.schemas.clients import ClientsResponse

router = APIRouter(tags=["clients"])


@router.get("/clients", response_model=ClientsResponse)
def list_clients(
    tenant_id: Annotated[str, Depends(current_tenant)],
    db: Annotated[Session, Depends(get_tenant_scoped_db)],
) -> ClientsResponse:
    return ClientsResponse(items=queries.list_clients(db, tenant_id))
