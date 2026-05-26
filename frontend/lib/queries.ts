"use client";

// TanStack Query hooks — the only thing the dashboard components import to
// read backend data. Each hook:
//
//   - Asks Clerk for a token rendered through the `forthea` JWT template
//     (see backend/app/auth/clerk.py). A plain session token won't carry the
//     tenants claim the backend needs.
//   - Reads the active tenant via useActiveTenant() and sends it as
//     X-Active-Tenant — required when the user has more than one tenant,
//     ignored otherwise.
//   - Gates with `enabled` so queries don't fire before Clerk has loaded or
//     before a tenant is resolved (avoids a 400 from the backend).
//   - Keys the cache by `[endpoint, tenant, ...filters]`. Switching tenant
//     therefore invalidates naturally — no manual `invalidateQueries` needed.
//
// Adding a new endpoint: add the response type in lib/api.ts, then write a
// thin hook here that calls `useApi` with the path + query. No other plumbing.

import { useAuth } from "@clerk/nextjs";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  ApiError,
  apiFetch,
  type AnomaliesResponse,
  type AnomalyFlag,
  type ClientsResponse,
  type MacroResponse,
  type MacroSeriesKey,
  type MeResponse,
  type PerformanceResponse,
} from "./api";
import { useActiveTenant } from "./use-active-tenant";

// =============================================================================
// Authed fetcher — the single place the Clerk token is acquired.
// =============================================================================

interface AuthedFetchArgs {
  path: string;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
}

function useAuthedFetcher() {
  const { getToken } = useAuth();
  const { active } = useActiveTenant();

  return useCallback(
    async <T>(args: AuthedFetchArgs): Promise<T> => {
      const token = await getToken({ template: "forthea" });
      if (!token) {
        // Hitting this means Clerk says you're signed out. Middleware should
        // have redirected to /sign-in already; surfacing 401 keeps the cause
        // visible if it ever slips through.
        throw new ApiError("Not signed in", 401);
      }
      return apiFetch<T>({
        path: args.path,
        query: args.query,
        token,
        tenant: active ?? undefined,
        signal: args.signal,
      });
    },
    [getToken, active],
  );
}

// Common gating + retry policy for tenant-scoped queries. Pulled out so each
// hook stays a one-liner.
function tenantQueryDefaults<T>(active: string | null, isReady: boolean) {
  return {
    enabled: isReady && !!active,
    retry: (failureCount: number, error: unknown) => {
      // No point retrying auth or input errors — they won't fix themselves.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  } satisfies Partial<UseQueryOptions<T>>;
}

// =============================================================================
// /me — smoke test + future "who am I" surface.
// =============================================================================

export function useMe() {
  const fetcher = useAuthedFetcher();
  const { active, isReady } = useActiveTenant();
  return useQuery({
    queryKey: ["me", active],
    queryFn: ({ signal }) => fetcher<MeResponse>({ path: "/me", signal }),
    ...tenantQueryDefaults<MeResponse>(active, isReady),
  });
}

// =============================================================================
// /clients — list of clients for the active tenant.
// =============================================================================

export function useClients() {
  const fetcher = useAuthedFetcher();
  const { active, isReady } = useActiveTenant();
  return useQuery({
    queryKey: ["clients", active],
    queryFn: ({ signal }) =>
      fetcher<ClientsResponse>({ path: "/clients", signal }),
    ...tenantQueryDefaults<ClientsResponse>(active, isReady),
  });
}

// =============================================================================
// /performance — cursor-paginated CPA / ROAS rows.
//
// Pagination here is intentionally page-at-a-time: the hook takes a `cursor`
// and the caller manages "next page" by holding the cursor in component state
// or in the URL. When we wire useInfiniteQuery later for a virtualized table,
// that wrapper composes on top of this hook.
// =============================================================================

export interface PerformanceFilters {
  start_date?: string;
  end_date?: string;
  cursor?: string;
  limit?: number;
}

export function usePerformance(filters: PerformanceFilters = {}) {
  const fetcher = useAuthedFetcher();
  const { active, isReady } = useActiveTenant();
  return useQuery({
    queryKey: ["performance", active, filters],
    queryFn: ({ signal }) =>
      fetcher<PerformanceResponse>({
        path: "/performance",
        // Cast: filter interfaces lack an index signature so they don't satisfy
        // Record<string, unknown> structurally. The runtime accepts any object.
        query: filters as Record<string, unknown>,
        signal,
      }),
    ...tenantQueryDefaults<PerformanceResponse>(active, isReady),
  });
}

// =============================================================================
// /anomalies — flagged client-days with optional flag-type filter.
// =============================================================================

export interface AnomaliesFilters {
  start_date?: string;
  end_date?: string;
  flag_type?: AnomalyFlag;
  cursor?: string;
  limit?: number;
}

export function useAnomalies(filters: AnomaliesFilters = {}) {
  const fetcher = useAuthedFetcher();
  const { active, isReady } = useActiveTenant();
  return useQuery({
    queryKey: ["anomalies", active, filters],
    queryFn: ({ signal }) =>
      fetcher<AnomaliesResponse>({
        path: "/anomalies",
        query: filters as Record<string, unknown>,
        signal,
      }),
    ...tenantQueryDefaults<AnomaliesResponse>(active, isReady),
  });
}

// =============================================================================
// /macro — FRED series. Tenant-independent (auth-only), but we still gate on
// `isReady` so it doesn't race the auth boot.
// =============================================================================

export interface MacroFilters {
  series?: MacroSeriesKey[];
  start_date?: string;
  end_date?: string;
}

export function useMacro(filters: MacroFilters = {}) {
  const fetcher = useAuthedFetcher();
  const { isReady } = useActiveTenant();
  return useQuery({
    queryKey: ["macro", filters],
    queryFn: ({ signal }) =>
      fetcher<MacroResponse>({
        path: "/macro",
        query: filters as Record<string, unknown>,
        signal,
      }),
    enabled: isReady,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
