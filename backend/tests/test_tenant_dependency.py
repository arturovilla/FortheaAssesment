"""Tests for the current_tenant resolver in app/auth/dependencies.py.

This is the single point that enforces NFR-1 (multi-tenancy): every
tenant-scoped endpoint depends on it. The rules are tight:

  - single-tenant user                   → that tenant; header ignored
  - multi-tenant user with valid header  → header value
  - multi-tenant user without header     → 400
  - multi-tenant user with wrong header  → 403
  - user with no tenants                 → 403

A regression here would silently break tenant isolation, which is the worst
class of bug this system can ship.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.auth.dependencies import current_tenant
from app.auth.models import AuthenticatedUser


def _user(tenants: list[str]) -> AuthenticatedUser:
    return AuthenticatedUser(user_id="u_test", email="x@example.com", tenants=tenants)


def test_single_tenant_user_resolves_to_their_tenant():
    assert current_tenant(_user(["apple"]), x_active_tenant=None) == "apple"


def test_single_tenant_user_ignores_header():
    # An agency user temporarily downgraded to one tenant should not be
    # surprised by a stale header from an earlier multi-tenant session.
    assert current_tenant(_user(["apple"]), x_active_tenant="disney") == "apple"


def test_multi_tenant_user_with_valid_header_resolves_to_header():
    user = _user(["apple", "disney", "google"])
    assert current_tenant(user, x_active_tenant="disney") == "disney"


def test_multi_tenant_user_without_header_is_400():
    user = _user(["apple", "disney"])
    with pytest.raises(HTTPException) as exc:
        current_tenant(user, x_active_tenant=None)
    assert exc.value.status_code == 400


def test_multi_tenant_user_with_unauthorized_header_is_403():
    user = _user(["apple", "disney"])
    with pytest.raises(HTTPException) as exc:
        current_tenant(user, x_active_tenant="netflix")
    assert exc.value.status_code == 403


def test_user_with_no_tenants_is_403():
    with pytest.raises(HTTPException) as exc:
        current_tenant(_user([]), x_active_tenant="apple")
    assert exc.value.status_code == 403
