"use client";

// Single source of truth for "which tenant is the dashboard operating on".
//
// Resolution order:
//   1. The `?tenant=<slug>` URL search param, if it's in the user's allowed set.
//   2. The first entry of `user.publicMetadata.tenants`.
//
// Why URL-first: the param is what the TenantSelector writes when the user
// switches; it's shareable, survives refresh, and lets us avoid global state.
// The Clerk metadata is the authoritative source of *which* tenants are
// allowed — the URL value is never trusted without intersecting it against
// that list.
//
// Both the TenantSelector and the API hooks (lib/queries.ts) consume this so
// the resolution lives in exactly one place.

import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export interface ActiveTenantState {
  // Resolved active tenant, or null when Clerk hasn't loaded yet or the user
  // has no tenant assignments at all.
  active: string | null;
  // Full set of tenants the user can access (from Clerk publicMetadata).
  tenants: string[];
  // True once Clerk's user object has finished loading. Queries should gate
  // on this so they don't fire with a stale/empty tenant.
  isReady: boolean;
  // True when the user has more than one tenant — switches the selector UI
  // between read-only chip and dropdown, and tells the API layer to send the
  // X-Active-Tenant header (the backend ignores it otherwise, but sending it
  // unconditionally is also fine).
  isMultiTenant: boolean;
}

export function useActiveTenant(): ActiveTenantState {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();

  const tenants =
    (user?.publicMetadata?.tenants as string[] | undefined) ?? [];

  const fromUrl = searchParams.get("tenant");
  const active =
    fromUrl && tenants.includes(fromUrl)
      ? fromUrl
      : (tenants[0] ?? null);

  return {
    active,
    tenants,
    isReady: isLoaded,
    isMultiTenant: tenants.length > 1,
  };
}
