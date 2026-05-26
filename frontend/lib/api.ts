// Typed fetch wrapper for the FortheaAssesment backend.
//
// Responsibilities:
//   - Resolve the API base URL (env-driven, default localhost:8000).
//   - Attach `Authorization: Bearer <Clerk JWT>` + optional `X-Active-Tenant`.
//   - Serialize query params (incl. repeated keys for list filters like ?series=).
//   - Parse FastAPI's `{ detail: ... }` error envelope into an `ApiError`.
//
// What it deliberately does NOT do:
//   - Know about Clerk or React. Callers pass the token in; the React/Clerk
//     glue lives in lib/queries.ts. This file is a plain function the tests
//     and the hooks can both use.
//
// Types below mirror the Pydantic models in backend/app/schemas/*. Keep them
// in sync by hand for now; if the surface grows, OpenAPI codegen is the
// natural next step.

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export type QueryValue = string | number | boolean | string[] | undefined | null;

// `query` is typed `Record<string, unknown>` rather than `Record<string,
// QueryValue>` so callers can pass concrete-shape filter objects (e.g.
// `{ start_date?: string }`) without TS demanding an index signature on
// every filter interface. Values are coerced at runtime; QueryValue
// documents the shapes that round-trip cleanly.
export interface ApiFetchOptions {
  path: string;
  query?: Record<string, unknown>;
  token: string;
  // Optional because single-tenant users don't need it; the backend ignores
  // X-Active-Tenant when the user has one tenant, and requires it otherwise.
  tenant?: string;
  signal?: AbortSignal;
}

export async function apiFetch<T>(opts: ApiFetchOptions): Promise<T> {
  const url = new URL(opts.path, API_BASE);
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        // Repeated key form: ?series=inflation&series=unemployment.
        // FastAPI's `Query(list[str])` parses this directly.
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    Accept: "application/json",
  };
  if (opts.tenant) headers["X-Active-Tenant"] = opts.tenant;

  const res = await fetch(url, { headers, signal: opts.signal });

  if (!res.ok) {
    // FastAPI returns { detail: "..." } or { detail: [{ msg, loc, type }, ...] }
    // for 422s. We surface the simple string form here; the array form is rare
    // for GETs and the components don't need field-level detail today.
    let detail: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      // body wasn't JSON; fall back to status text below.
    }
    throw new ApiError(
      detail ?? `${res.status} ${res.statusText}`,
      res.status,
      detail,
    );
  }

  return res.json() as Promise<T>;
}

// =============================================================================
// Response types — kept in lockstep with backend/app/schemas/*.py.
// Decimal fields come over the wire as JSON strings (FastAPI default for
// pydantic Decimal). UI code should parse with Number()/parseFloat where math
// is needed.
// =============================================================================

export interface MeResponse {
  user_id: string;
  email: string | null;
  active_tenant: string;
  available_tenants: string[];
}

export interface ClientSummary {
  client_id: string;
  client_name: string;
  expected_revenue_from_acquisition: string;
  google_campaign_count: number;
  meta_campaign_count: number;
}

export interface ClientsResponse {
  items: ClientSummary[];
}

export interface PerformanceRow {
  client_id: string;
  client_name: string;
  activity_date: string; // ISO date (YYYY-MM-DD)
  total_spend: string;
  total_conversions: string;
  expected_revenue_from_acquisition: string;
  total_revenue: string;
  cpa: string | null;
  roas: string | null;
}

export interface PerformanceResponse {
  items: PerformanceRow[];
  next_cursor: string | null;
  has_more: boolean;
}

export type AnomalyFlag =
  | "zero_conversions"
  | "cpa_spike"
  | "roas_collapse"
  | "spend_spike";

export interface AnomalyRow {
  client_id: string;
  client_name: string;
  activity_date: string;
  total_spend: string;
  total_conversions: string;
  cpa: string | null;
  roas: string | null;
  cpa_zscore: string | null;
  roas_zscore: string | null;
  is_zero_conversions_with_spend: boolean;
  is_cpa_spike: boolean;
  is_roas_collapse: boolean;
  is_spend_spike: boolean;
}

export interface AnomaliesResponse {
  items: AnomalyRow[];
  next_cursor: string | null;
  has_more: boolean;
}

export type MacroSeriesKey =
  | "inflation"
  | "unemployment"
  | "sentiment"
  | "fed_funds";

// =============================================================================
// Uploads (mirror backend/app/schemas/uploads.py)
// =============================================================================

export type UploadType = "google_ads" | "meta" | "clients";
export type UploadStatus = "pending" | "processing" | "succeeded" | "failed";

export interface InitiateResponse {
  upload_id: string;
  presigned_url: string;
}

export interface CommitResponse {
  upload_id: string;
  status: UploadStatus;
}

export interface UploadStatusResponse {
  upload_id: string;
  type: UploadType;
  status: UploadStatus;
  accepted: number | null;
  rejected: number | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface Observation {
  date: string;
  value: string | null;
}

export interface MacroSeries {
  key: string;
  series_id: string;
  title: string;
  observations: Observation[];
}

export interface MacroResponse {
  items: MacroSeries[];
}
