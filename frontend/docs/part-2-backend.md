# Part 2: Backend (FastAPI)

## 1. Overview

### 1.1 What this service is

A FastAPI service between data sources (Part 3 pipeline, ad-hoc JSON uploads) and the Part 4 dashboard. Ingests marketing data, persists it, serves dashboard reads from the Part 3 marts.

### 1.2 What this service is not

- **Not the analytical engine.** Heavy aggregations live in Snowflake (Part 1 §4); the backend queries the marts.
- **Not the orchestrator.** Scheduled extractions are Airflow's job (Part 3 §2).
- **Not the system of record for clients.** Master data lives in the operational store's `tenants` / `tenant_integrations` (Part 1 §2.5).

### 1.3 How it connects to the rest of the system

- Runs on Azure Container Apps (Part 1 §5.2), behind Azure Front Door + WAF.
- Writes to operational Postgres for app state and upload metadata.
- Reads Snowflake `MARTS` for analytics.
- Tenant scoping inherits Part 1 §2.4's three-layer model (token → session variable → RLS).

### 1.4 Request flow

Edge → middleware chain → router → store. Each routed handler talks only to the stores it needs. The full picture has a lot going on, so we walk through it in three focused layers (edge + middleware, async upload writes, mart reads), then show the integrated topology at the end. Solid edges = data paths; dashed = control plane / handoffs that don't carry bytes.

#### Edge + middleware chain

What every authenticated request goes through before any router code runs. Azure Front Door terminates TLS, WAF, and rate-limits at the edge; inside the backend, three middleware steps run in order so RLS is armed before any query fires.

```mermaid
flowchart TB
    client(["Client<br/>(Next.js dashboard)"])
    fd["Azure Front Door<br/>TLS · WAF · rate limit"]

    subgraph backend["FastAPI Backend"]
        direction TB
        subgraph middleware["Per-request middleware"]
            direction LR
            auth["Auth<br/>validate Clerk JWT"]
            tenant["Tenant<br/>resolve active tenant"]
            session["Session var<br/>set_config(<br/>app.current_tenant)"]
            auth --> tenant --> session
        end
        router["Route handler"]
        middleware --> router
    end

    client --> fd --> backend

    classDef comp fill:#1e1e2e,stroke:#585b70,stroke-width:1.5px,color:#cdd6f4,font-size:24px
    class client,fd,auth,tenant,session,router comp
    linkStyle default stroke:#7f849c,stroke-width:2px
    style backend fill:#181825,stroke:#45475a,color:#a6adc8
    style middleware fill:#313244,stroke:#45475a,color:#a6adc8
```

#### Async write path (Uploads)

The uploads router orchestrates rather than carries bytes (§2.2). It writes an `uploads` row to Postgres, issues a presigned URL the client uses to PUT bytes directly to Blob, then triggers the worker DAG on commit. The dashed edges are control-plane handoffs; only the `client → blob` arrow carries the actual payload.

```mermaid
flowchart TB
    client(["Client<br/>(Next.js dashboard)"])

    subgraph backend["FastAPI Backend"]
        ru["Uploads router"]
    end

    pg[("Postgres<br/>operational")]
    blob[("Blob Storage")]
    airflow["Airflow"]

    client --> ru
    ru -->|uploads row| pg
    ru -.->|presign URL| blob
    ru -.->|trigger DAG| airflow

    client -->|PUT bytes<br/>via presigned URL| blob

    classDef comp fill:#1e1e2e,stroke:#585b70,stroke-width:1.5px,color:#cdd6f4,font-size:24px
    class client,ru,pg,blob,airflow comp
    linkStyle default stroke:#7f849c,stroke-width:2px
    style backend fill:#181825,stroke:#45475a,color:#a6adc8
```

#### Read paths

Four read endpoints, three stores. Performance and Anomalies hit Snowflake's marts (production target; local dev points at Postgres mart views per the Implementation Scope swap). Clients reads `dim_client` straight from Postgres. Macro proxies FRED with an in-process cache.

```mermaid
flowchart TB
    client(["Client<br/>(Next.js dashboard)"])

    subgraph backend["FastAPI Backend"]
        direction LR
        rp["Performance"]
        ra["Anomalies"]
        rc["Clients"]
        rm["Macro"]
    end

    snow[("Snowflake<br/>MARTS")]
    pg[("Postgres<br/>operational")]
    fred["FRED API"]

    client --> backend
    rp -->|read marts| snow
    ra -->|read marts| snow
    rc -->|read dim_client| pg
    rm -->|cached proxy| fred

    classDef comp fill:#1e1e2e,stroke:#585b70,stroke-width:1.5px,color:#cdd6f4,font-size:24px
    class client,rp,ra,rc,rm,snow,pg,fred comp
    linkStyle default stroke:#7f849c,stroke-width:2px
    style backend fill:#181825,stroke:#45475a,color:#a6adc8
```

#### Full topology

Everything together in one view. The three layers above are the easier read for understanding what each piece does; this one is the reference.

```mermaid
flowchart TB
    %% Edge → middleware → routers → stores. Solid arrows are data paths;
    %% dashed arrows are control-plane / handoffs that don't carry bytes.

    client(["Client<br/>(Next.js dashboard)"])
    fd["Azure Front Door<br/>TLS · WAF · rate limit"]

    subgraph backend["FastAPI Backend"]
        direction TB
        subgraph middleware["Per-request middleware"]
            direction LR
            auth["Auth<br/>validate Clerk JWT"]
            tenant["Tenant<br/>resolve active tenant"]
            session["Session var<br/>set_config(<br/>app.current_tenant)"]
            auth --> tenant --> session
        end

        subgraph routers["Routers"]
            direction LR
            ru["Uploads"]
            rp["Performance"]
            ra["Anomalies"]
            rc["Clients"]
            rm["Macro"]
        end

        middleware --> routers
    end

    subgraph stores["Stores and external services"]
        direction LR
        pg[("Postgres<br/>operational")]
        snow[("Snowflake<br/>MARTS")]
        blob[("Blob Storage")]
        airflow["Airflow"]
        fred["FRED API"]
    end

    client --> fd --> backend

    %% Uploads router orchestrates rather than carrying bytes (§2.2):
    %%   - writes the uploads row to Postgres
    %%   - issues a presigned URL (control)
    %%   - triggers the worker DAG on commit (control)
    ru -->|uploads row| pg
    ru -.->|presign URL| blob
    ru -.->|trigger DAG| airflow

    %% The actual byte path bypasses the API entirely (§2.2).
    client -.->|PUT bytes<br/>via presigned URL| blob

    rp -->|read marts| snow
    ra -->|read marts| snow
    rc -->|read dim_client| pg
    rm -->|cached proxy| fred

    classDef comp fill:#1e1e2e,stroke:#585b70,stroke-width:1.5px,color:#cdd6f4,font-size:28px
    class client,fd,auth,tenant,session,ru,rp,ra,rc,rm,pg,snow,blob,airflow,fred comp
    linkStyle default stroke:#7f849c,stroke-width:2px
    style backend fill:#181825,stroke:#45475a,color:#a6adc8
    style middleware fill:#313244,stroke:#45475a,color:#a6adc8
    style routers fill:#313244,stroke:#45475a,color:#a6adc8
    style stores fill:#181825,stroke:#45475a,color:#a6adc8
```

Three things the full topology makes visible at a glance:

- **The middleware chain** (auth → tenant → session var) runs on every authenticated request, in order. The session variable is set before any router code runs, so RLS is already armed by the time a query fires.
- **Routers are thin.** Each handler maps to one or two stores; no router talks to everything.
- **The stores are heterogeneous on purpose.** Uploads coordinate Postgres + Blob + Airflow (bytes go client → blob direct); mart reads hit Snowflake; the macro endpoint proxies FRED.

### 1.5 Authentication

**Decision:** Clerk (managed identity provider, SaaS). Issues and signs JWTs; the backend validates them and reads tenant context from each user's `publicMetadata`.

- Three demo users in Clerk: two single-tenant clients + one agency-staff user with access to all three demo tenants.
- Real auth, not a stub. Integration details in §6.
- No cloud account or paid plan required — Clerk's free tier covers the demo.

**Alternative considered: Auth0.** Same integration shape (validate JWT, read claims); swap is mechanical. Clerk wins on Next.js integration polish; Auth0 wins on enterprise familiarity. Either is defensible.

## 2. API Surface

**Decision:** Two halves — **one async write pattern** for ingestion, **mart-shaped reads** for queries.

- **Writes:** single ingest pattern (initiate → upload-to-blob → commit → poll). Type-agnostic at the API layer; the worker dispatches on the schema type stored at initiate.
- **Reads:** endpoints map to marts and the client dimension, not to raw staging. The marts (Part 3 §9) exist so the serving layer doesn't join paid-media sources at query time.

### 2.1 Endpoint inventory

All paths below are served by the FastAPI backend. In local dev that's
`http://localhost:8000` (the Next.js dashboard runs separately on
`:3000`). Endpoints tagged with a <span style="display:inline-block;padding:1px 9px;border:1px solid #fab387;border-radius:9999px;color:#fab387;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Local dev</span> pill exist only in the local stack and are absent
from the production deployment.

| Endpoint                       | Method | Behavior                                    | Notes                                                                                            |
| ------------------------------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /uploads/initiate`       | Write  | Returns `{ upload_id, presigned_url }`      | Body: `{ type: "google_ads" \| "meta" \| "clients" }`. Short-lived presigned blob URL.           |
| `PUT  /uploads/{id}/blob`      | Write  | Returns `204`; writes upload bytes to blob  | <span style="display:inline-block;padding:1px 9px;border:1px solid #fab387;border-radius:9999px;color:#fab387;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Local dev</span> Stand-in for an Azure SAS URL. In prod, clients PUT directly to blob storage and this route does not exist on the backend. |
| `POST /uploads/{id}/commit`    | Write  | Returns `202` with `{ status: processing }` | Signals upload complete; triggers async ingest                                                   |
| `GET /uploads/{id}`            | Read   | Returns `{ status, accepted, rejected, error, type, created_at, processed_at }` | Polled by client; status = `pending` \| `processing` \| `succeeded` \| `failed`                  |
| `GET /clients`                 | Read   | `dim_client` (+ per-client Google / Meta campaign counts) | Client list for the dashboard selector                                                |
| `GET /performance`             | Read   | `mart_client_daily_performance`             | Daily client-level rows; paginated + filtered                                                    |
| `GET /anomalies`               | Read   | `mart_client_daily_anomalies`               | Flagged anomalies for the dashboard                                                              |
| `GET /macro`                   | Read   | FRED API (cached)                           | Dashboard enrichment data                                                                        |
| `GET /me`                      | Read   | Returns `{ user_id, email, active_tenant, available_tenants }` | Auth-wiring smoke test. Confirms the JWT validates and tenant resolution settled correctly. The dashboard's `useMe` hook calls this. |
| `GET /health`                  | Read   | Returns `{ status, database, env }`         | Liveness check, no auth                                                                          |
| `GET /docs`                    | Read   | Renders Swagger UI                          | OpenAPI (auto-generated by FastAPI). Open it at [http://localhost:8000/docs](http://localhost:8000/docs) when the backend is running locally. |

### 2.2 The single async ingest pattern

One pattern for all payloads, any size, any schema:

- **`POST /uploads/initiate`** declares the schema `type`; backend creates the `uploads` row, returns a presigned blob URL + `upload_id`.
- **Client uploads bytes** directly to the presigned URL (bypasses the API).
- **`POST /uploads/{id}/commit`** triggers the Airflow `uploads_ingest_dag`, returns `202`.
- **`GET /uploads/{id}`** for status.

Route handlers are short. Fast work only. **No Pydantic dispatch in the route.** The schema `type` is stored on the `uploads` row at `initiate`; the worker reads the row and picks the correct Pydantic model (`GoogleAdsRecord`, `MetaAdsRecord`, or `ClientRecord`) at validation time.

```python
class InitiateRequest(BaseModel):
    type: Literal["google_ads", "meta", "clients"]

@router.post("/uploads/initiate")
async def initiate(
    body: InitiateRequest,
    tenant: TenantContext = Depends(active_tenant),
):
    upload_id = uuid.uuid4()
    presigned_url = await blob.presign_upload(upload_id, ttl=900)
    await db.upload_create(upload_id, tenant_id=tenant.active, type=body.type)
    return {"upload_id": upload_id, "presigned_url": presigned_url}

@router.post("/uploads/{upload_id}/commit", status_code=202)
async def commit(
    upload_id: UUID,
    tenant: TenantContext = Depends(active_tenant),
):
    await db.upload_assert_belongs_to(upload_id, tenant)
    await airflow.trigger_dag("uploads_ingest_dag", conf={"upload_id": str(upload_id)})
    await db.upload_set_status(upload_id, "processing")
    return {"upload_id": upload_id, "status": "processing"}
```

The worker (`uploads_ingest_dag`) reads the blob, selects the Pydantic model by the upload row's `type`, validates each record, bulk-inserts the valid ones into the matching staging table, and updates the uploads row with `accepted` / `rejected` counts plus the first error message. Validation stays server-side and authoritative; it just runs in the worker, not in the request handler. (A production deployment would also push rejected rows to a dead-letter table per Part 3 §6.4; the local worker keeps failures as counts on the uploads row.)

**Why store `type` on the `uploads` row?**

- Gives the worker a single source of truth that doesn't depend on how the upload was initiated.
- Keeps the API surface fixed regardless of how many schemas the platform supports.

## 3. Schema Validation

**Decision:** Pydantic models mirror the brief's three schemas one-to-one. Validation runs server-side in the async ingest worker, before records reach staging. The schema `type` is set on the `uploads` row at `initiate`; the worker selects the matching model.

- **Three models:** `GoogleAdsRecord`, `MetaAdsRecord`, `ClientRecord` — one per staging table (Part 3 §3.2).
- **Errors return 422** with field-level detail (FastAPI's default behavior).
- **`tenant_id` rule:** never trusted from the uploaded payload. Bound to the `uploads` row from the authenticated request; the worker uses that value.
- **Type coercion:** date strings → `date`, numeric strings → `Decimal`, per Pydantic V2.

## 4. Persistence Layer

**Decision:** SQLAlchemy 2.0 with typed ORM models, Alembic for migrations.

- **Schema mirrors Part 3 §3.2** for staging tables (`stg_google_ads`, `stg_meta_ads`, `dim_client`), plus `tenants` / `tenant_integrations` / `user_tenant_access` from Part 1 §2.5.
- **Bulk inserts** on ingest, one round-trip per batch.
- **Natural-key dedup:** `(tenant_id, campaign_id, date)` for Google Ads; `(tenant_id, campaign_name, dma, day)` for Meta (Part 3 §3.4).
- **Idempotency:** re-ingesting a `(natural_key)` overwrites rather than appending, matching the pipeline's partition-replace model.
- **Migrations** in `backend/migrations/`, versioned per Part 1 §7.1.

**Alternatives considered:**

- **SQLModel.** Pydantic + SQLAlchemy fusion; less boilerplate for CRUD shapes. Smaller community, fewer mature recipes for advanced patterns.
- **Raw SQL via psycopg / asyncpg.** No ORM abstraction tax, most explicit, but more boilerplate to write by hand.

SQLAlchemy 2.0 wins on typed ORM + Alembic ecosystem + community depth.

## 5. The Query Endpoint Design

**Decision:** Cursor-based pagination on every list endpoint. Filters as query-string parameters validated by Pydantic.

- **Cursor format:** opaque base64-encoded tuple. `GET /performance` cursors on `(activity_date, client_id)`.
- **Response shape:** `{ "items": [...], "next_cursor": "...", "has_more": true }`.
- **Filters on `GET /performance`:** `client_id`, `start_date`, `end_date`, optional `min_spend`, `min_roas`.
- **Filters on `GET /anomalies`:** `client_id`, `flag_type`, `start_date`, `end_date`.
- **Page-size limits:** default 50, max 500.
- **Sorting:** fixed sort order per endpoint so cursor pagination is stable across pages.

**Alternative considered: offset/limit pagination.** Simpler (`?page=2&size=50`) and easier to explain. Loses correctness under concurrent inserts (rows shift between pages) and degrades for deep pages on large tables. Cursor pagination handles both.

## 6. Tenant Scoping

**Decision:** Part 1 §2.4's three-layer model (token → session variable → RLS) realized as a FastAPI dependency wrapping every authenticated route.

### 6.1 Resolution flow

- Auth dependency validates the Clerk JWT against Clerk's JWKS endpoint, reads `publicMetadata` for permitted tenants.
- **External users:** active tenant is the only one in their permission set.
- **Agency staff:** active tenant comes from a request header (`X-Active-Tenant`), validated against `user_tenant_access`.
- Session variable is set on the SQLAlchemy connection at the start of every request.
- RLS policies on Postgres enforce the boundary; mirrored as row access policies in Snowflake for read queries.
- No tenant context, no service: an unauthenticated request to a tenant-scoped endpoint returns 401, not 200-with-no-rows.

### 6.2 Session-variable lifecycle (avoiding tenant leakage)

**The failure mode:** SQLAlchemy reuses connections from a pool. If request A sets `app.current_tenant = 'X'` and returns the connection without resetting, the next request inherits the wrong tenant context. RLS then returns the wrong rows. Real tenant-leak risk, has to be designed against.

**Defense is three-layered, all SQLAlchemy-native configuration:**

1. **Transaction-scoped GUC.** Every request runs in an explicit transaction; tenant is set with `SELECT set_config('app.current_tenant', '<tenant>', true)`. The `true` third arg makes the setting transaction-local (equivalent to `SET LOCAL`); the function form is used instead of literal `SET LOCAL` because Postgres' `SET` syntax does not accept bind parameters. On commit or rollback, the setting is gone. The next request gets a clean connection.
2. **Reset on pool check-in.** An `event.listens_for(engine, "reset")` hook runs `RESET app.current_tenant` whenever a connection returns to the pool. Belt-and-suspenders for layer 1.
3. **Middleware sets unconditionally.** The per-request dependency grabs a connection and *always* sets `app.current_tenant` to the current request's tenant. Never inherits prior state.

To leak a tenant, all three must fail at once. Any one holding prevents the leak. Standard pattern in multi-tenant Postgres-with-RLS systems (Heroku, Crunchy Data, Supabase ship this as default practice).

**Alternative considered: skip session variables entirely**, inject `tenant_id` into every query's `WHERE` clause via SQLAlchemy's `with_loader_criteria` or a global filter. Works, but harder to apply consistently and easy to bypass with raw SQL.

### 6.3 CORS

The Next.js dashboard and FastAPI backend are on different origins. FastAPI's `CORSMiddleware` is configured to:

- Allow only the dashboard's known origins (never `*` when credentials are involved).
- Permit `GET`, `POST`, `OPTIONS`.
- Permit the headers we send: `Authorization`, `Content-Type`, `X-Active-Tenant`.
- `allow_credentials=True` so the browser sends the bearer token cross-origin.

Without this, the browser hard-fails every dashboard → backend call with a CORS error before the request leaves the browser.

## 7. Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, router registration
│   ├── settings.py          # Pydantic Settings (env-driven config)
│   ├── auth/                # Token validation, tenant resolution
│   ├── routers/
│   │   ├── uploads.py
│   │   ├── performance.py
│   │   ├── anomalies.py
│   │   ├── clients.py
│   │   └── macro.py
│   ├── schemas/             # Pydantic models (request/response)
│   ├── db/
│   │   ├── models.py        # SQLAlchemy ORM
│   │   ├── session.py       # Connection + session-variable middleware
│   │   └── queries.py       # Reusable mart queries
│   └── services/            # FRED client, blob upload, etc.
├── alembic/                 # migrations + env.py
├── alembic.ini
├── tests/
├── Dockerfile
├── requirements.txt
└── README.md
```

Configuration via Pydantic Settings, driven from env vars: `DATABASE_URL`, `SNOWFLAKE_*`, `CLERK_*`, `FRED_API_KEY`, `BLOB_STORAGE_URL`.

## 8. Testing

**Decision:** Three test layers (unit, integration, contract). Unit layer is shipped and gated on container startup; the other two are designed.

### 8.1 Unit tests (shipped)

Live at `backend/tests/`. Three files, 15 tests, covering the three places where a regression silently breaks a contract:

- **`test_cursor.py`** — opaque pagination cursor: encode/decode roundtrip, padding contract, malformed input becomes a 400, non-dict payload rejected. Protects `/performance` and `/anomalies` pagination.
- **`test_ingest_schemas.py`** — Pydantic record schemas for the three upload types: valid payload accepted, missing required field rejected, unknown fields silently dropped (the `extra="ignore"` contract). Protects FR-2.3 / NFR-9.
- **`test_tenant_dependency.py`** — the `current_tenant` resolver: single-tenant resolves and ignores header, multi-tenant with valid header resolves, multi-tenant without header is 400, multi-tenant with unauthorized header is 403, no-tenant user is 403. Protects NFR-1 (tenant isolation), the worst-case failure mode in the platform.

**Gating:** `backend/docker-entrypoint.sh` runs `pytest tests/ -q` before alembic migrations and before uvicorn binds. `set -e` makes a failing test abort the container, so a backend that doesn't pass its own contract never accepts traffic.

### 8.2 Integration tests (designed)

Against a Postgres test container (`testcontainers`), exercising the full ingest → read flow with data from the generator. Not shipped; the docker-entrypoint design intentionally restricts startup tests to ones that don't need a populated database.

### 8.3 Contract test (designed)

Frozen OpenAPI snapshot fails the build if the public surface changes unexpectedly. Not shipped.

### 8.4 CI

Same `pytest tests/` runs on every pull request (Part 1 §7.3); the docker-entrypoint invocation is the second line of defense for environments that bypass CI.

## 9. Summary

- FastAPI app between data sources and the dashboard.
- Single async write pattern (initiate → upload → commit → poll); mart-shaped reads.
- Cursor-paginated, tenant-scoped queries over the Part 3 marts.
- SQLAlchemy 2.0 + Alembic; Part 1 §7.1 versioning model.
- Real Clerk auth, not a stub.
- Unit tests shipped and gated on container startup; integration + contract layers designed.

---

## Decision Log

| Area | Decision | Reasoning |
|------|----------|-----------|
| API shape | Single async ingest, mart-shaped reads | _§2_ |
| Authentication | Clerk (managed IdP) | _§1.4, §6_ |
| Pagination | Cursor-based | _§5_ |
| Data layer | SQLAlchemy 2.0 + Alembic | _§4_ |
| Tenant scoping | Token → session var → RLS (Part 1 §2.4) | _§6_ |
