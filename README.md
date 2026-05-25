# Forthea Senior Software Engineer Assessment

This repository contains my response to the five-section assessment: architecture design, a Python backend service, a data engineering pipeline, a Next.js dashboard, and an LLM feature design.

## Requirements

The following requirements are extracted from the assessment brief. They are split into **functional requirements** (what the system must do) and **non-functional requirements** (the qualities it must have). Each item is tagged with the section it comes from.

### Functional Requirements

#### Section 1 — Architecture & Systems Design

- **FR-1.1** Design a multi-tenant analytics system that lets a user monitor and analyze website traffic data for their own website.
- **FR-1.2** Source traffic data from Google Analytics 4 (GA4).
- **FR-1.3** Front end built with React / Next.js.
- **FR-1.4** Backend built with Python or Node.
- **FR-1.5** Persist data into a single unified data warehouse.
- **FR-1.6** Deliver architecture diagrams and detailed written reasoning.
- **FR-1.7** Define the pipeline using Infrastructure as Code (IaC).

#### Section 2 — Python Backend

- **FR-2.1** Build a FastAPI service.
- **FR-2.2** Ingest marketing data supplied as JSON.
- **FR-2.3** Validate incoming data against a schema.
- **FR-2.4** Store validated data to a SQL database.
- **FR-2.5** Expose a query endpoint that supports pagination.
- **FR-2.6** The query endpoint supports filtering.

#### Section 3 — Data Engineering

- **FR-3.1** Design a cloud-based pipeline that ingests daily Google Ads and Meta campaign data for active campaigns.
- **FR-3.2** Include orchestration for the pipeline.
- **FR-3.3** Include storage for the ingested data.
- **FR-3.4** Include exception handling.
- **FR-3.5** Include testing.
- **FR-3.6** Document how to connect to the Google Ads API and the Meta API.
- **FR-3.7** Provide example API queries that return reports matching the Google Ads and Meta Ads schemas below.
- **FR-3.8** Write SQL that builds daily client-level CPA tables.
- **FR-3.9** Write SQL that builds daily client-level ROAS tables.
- **FR-3.10** Write SQL that detects anomalies in the CPA / ROAS data.

#### Section 4 — React / Next.js

- **FR-4.1** Build a dashboard page.
- **FR-4.2** Include a client selector.
- **FR-4.3** Include KPI cards.
- **FR-4.4** Include a paginated table.
- **FR-4.5** Integrate an external API (e.g. US Census or FRED).
- **FR-4.6** Include error boundaries.
- **FR-4.7** Include loading states.

#### Section 5 — LLM / AI Integration

- **FR-5.1** Design and justify an LLM-powered feature (e.g. anomaly explanations or a call-scoring QA layer).
- **FR-5.2** Define monitoring for the feature.
- **FR-5.3** Define guardrails for the feature.
- **FR-5.4** Define evaluation metrics for the feature.

### Non-Functional Requirements

- **NFR-1 — Multi-tenancy.** The system must isolate data and access per tenant so each user only sees their own website's data. (Section 1)
- **NFR-2 — Cloud strategy.** The pipeline must be Azure-first but portable across clouds (multi-cloud capable). (Sections 1, 3)
- **NFR-3 — Scalability.** The data pipeline must handle roughly 10,000 active Google Ads campaigns and roughly 20,000 active Meta DMA-campaigns per day. (Section 3)
- **NFR-4 — Reliability / SLAs.** The pipeline must meet defined Service Level Agreements. (Section 3)
- **NFR-5 — Versioning.** The architecture must support versioning of infrastructure and deployments. (Section 1)
- **NFR-6 — Rollback.** The architecture must support a rollback strategy. (Section 1)
- **NFR-7 — Monitoring / observability.** Both the platform (Section 1) and the LLM feature (Section 5) must be monitored.
- **NFR-8 — Reproducible infrastructure.** Infrastructure must be defined as code so it is versioned and repeatable. (Section 1)
- **NFR-9 — Data quality.** Ingested data must be schema-validated before storage. (Section 2)
- **NFR-10 — Query performance.** Query results must be paginated and filterable so responses stay bounded as data grows. (Section 2)
- **NFR-11 — Resilience.** The system must handle failures gracefully: backend exception handling (Section 3) and front-end error boundaries with loading states (Section 4).
- **NFR-12 — Testability.** The pipeline must be covered by tests. (Section 3)
- **NFR-13 — AI safety.** The LLM feature must have guardrails and measurable evaluation metrics. (Section 5)
- **NFR-14 — Deliverability.** All code, diagrams, and written responses must be submitted in a single GitHub repo or zipped folder within 5 days. (Instructions)

## Data Schemas

The assessment defines three schemas used across Sections 3 and 4.

### Google Ads Schema

| Campaign_id | Campaign_type | Date | Spend | Impressions | Clicks | Conversions |
|-------------|---------------|------|-------|-------------|--------|-------------|

### Meta Ads Schema

| Campaign name | DMA | Day | Spend | Reach | Impressions | Clicks | Result Type | Results |
|---------------|-----|-----|-------|-------|-------------|--------|-------------|---------|

### Client Table Schema

| Client Name | Client ID | GA Campaign_id | Meta Campaign Name | Expected Revenue from Acquisition |
|-------------|-----------|----------------|--------------------|-----------------------------------|

## Scoping Decisions

The brief leaves several scoping points open. They are resolved here with stated assumptions so the deliverables stay consistent:

- **System scope.** Sections 2–4 are built as **one connected system**: the Section 2 FastAPI backend stores the campaign and client data, and the Section 4 dashboard reads from it. The three data schemas are shared across all sections.
- **External API role.** The Section 4 external API (US Census / FRED) acts as an **enrichment layer**: economic context is blended alongside the marketing KPIs rather than being a standalone widget or the primary dataset.
- **IaC depth.** Section 1 documents the Terraform strategy thoroughly (§6) but does not include runnable code. The cloud accounts needed to provision and test infrastructure are out of scope for this assessment.
- **Sample data.** The brief provides schemas but no data, by design. Realistic **synthetic datasets** matching the Google Ads, Meta, and Client table schemas are generated for Sections 2–4.
- **API access reality.** Neither the Google Ads API, the Meta Marketing API, nor GA4's BigQuery export offers a free path to real data: Google Ads test accounts return empty metrics, Meta sandbox returns synthetic-but-meaningless data, and the GA4 export needs a live property. The synthetic generator above is therefore required, not optional. Real API connection details are still documented (Part 3 §4 and §5).
- **Effort focus.** Depth is concentrated on **Section 1 (architecture)** and the **Section 2 + Section 4 build**. Sections 3 and 5 are delivered as thorough design documents with the required SQL and example queries.

## Part 1 Architecture Decisions

The core design choices for the Section 1 architecture, locked before implementation:

- **Multi-tenancy.** Shared schema with row-level isolation: every row carries a `tenant_id` and isolation is enforced by row-level security. Chosen over schema-per-tenant and db-per-tenant for cost and scale.
- **Unified warehouse.** Snowflake, deployed on Azure to satisfy Azure-first while staying genuinely portable across clouds. It is the analytical store; a managed Postgres / Azure SQL serves as the operational store.
- **Compute / hosting.** Azure Container Apps for the backend and frontend: serverless containers with low operational overhead, and containers stay portable to any cloud runtime.
- **GA4 ingestion.** GA4's native free BigQuery export (raw event-level data), with a pipeline stage moving it from BigQuery into Snowflake.
- **IaC.** Terraform strategy fully documented in Part 1 §6 (modules, environments, state backend, bootstrap, delivery flow). No runnable code committed for this assessment.
- **Ingest API.** Single async pattern: `POST /uploads/initiate` → client uploads to a presigned blob URL → `POST /uploads/{id}/commit` → poll `GET /uploads/{id}`. Validation runs in the Airflow worker, not in the request handler. Reuses the existing orchestrator rather than running a dedicated validator service.

## Implementation Scope

This assessment ships **documented design across all five sections** plus **runnable code for the parts where it adds the most signal**. The split is deliberate, not a compromise.

| Section | Documented | Coded | Notes |
|---------|------------|-------|-------|
| 1 — Architecture | Full design doc | — | IaC strategy documented in §6; no Terraform code (no cloud accounts) |
| 2 — Backend | Full design doc | **Yes, runnable** | FastAPI service with real Clerk auth, Postgres persistence, paginated mart queries |
| 3 — Data Engineering | Full design doc | **CPA/ROAS + anomaly SQL** | Pipeline designed, not deployed; SQL is real and runs against Postgres locally |
| 4 — Dashboard | (covered by Section 4 requirements) | **Yes, runnable** | Next.js, reads the backend, includes FRED enrichment widget |
| 5 — LLM Integration | Full design doc | — | Design only; no LLM API calls (avoids paid model traffic for a job application) |
| Data generator | Full doc | **Yes, runnable** | Generates synthetic data for the brief's three schemas across three tenants |

### Deliberately out of scope for the code

- **Airflow orchestrator** — Section 3 territory; designed in the doc, not built.
- **Presigned-URL upload flow** — documented as the large-payload pattern; direct `POST` satisfies the brief.
- **Snowflake connectivity in code** — local dev uses Postgres for both operational and analytical state; the Snowflake swap is documented as the production target.
- **Real cloud deployment / Terraform** — no cloud accounts provisioned for the assessment.
- **LLM API calls** — Section 5 is design-only.
- **Real Auth0 wiring** — Clerk is the chosen IdP for the built backend; Auth0 stays documented as the equivalent alternative.

## System Properties (Consistency, Availability, Partition tolerance)

CAP says under a network partition you choose between consistency and availability. The platform's posture, stated explicitly:

- **Consistency: eventual.** Acceptable because the product is analytical, not transactional.
  - The batch pipeline runs daily, so marts reflect at best yesterday's data.
  - Ad-hoc uploads (e.g. a 3 GB JSON file) take minutes to validate and reach the marts; the user sees `status: processing` in the meantime.
  - Google Ads and Meta restate metrics over several days; latency is built into the source platforms.
  - **A user uploading data expects it to appear in the dashboard shortly, not instantly.** Strong consistency is not a product requirement.

- **Availability: high.** The dashboard is the user's daily interface and must be there.
  - Frontend and backend run on Azure Container Apps with KEDA autoscaling (Part 1 §5.2).
  - Snowflake `WH_SERVING` is a multi-cluster warehouse, so concurrent users don't queue (Part 1 §4.4).
  - Azure Front Door + WAF at the edge (Part 1 §5.2) handles TLS, DDoS, rate limiting.
  - Within a region: high availability.
  - Across regions: single-region deployment with cross-region snapshots; RTO 8h, RPO 24h (Part 1 §7.4).

- **Partition tolerance: largely moot within the deployment; async at the edges.**
  - Single Azure region. Intra-region network reliability is Azure's problem; we don't operate cross-region active-active.
  - Cross-region DR uses **asynchronous** replication (Snowflake cross-region, Azure GZRS for blobs, periodic Postgres dumps). On a partition between regions, we accept staleness in the secondary, not a live consistency dilemma.

**By CAP: this platform is AP** (availability + eventual consistency). In PACELC: **PA/EL** — under partition, choose Availability; otherwise, choose low Latency over strong Consistency. A standard posture for analytical platforms where dashboards must always answer and absolute freshness is not the contract.

## Documentation

| Section | Document | Status |
|---------|----------|--------|
| Part 1 — Architecture & Systems Design | [`docs/part-1-architecture.md`](docs/part-1-architecture.md) | Documented |
| Part 2 — Backend (FastAPI) | [`docs/part-2-backend.md`](docs/part-2-backend.md) | Documented (code pending) |
| Part 3 — Data Engineering | [`docs/part-3-data-engineering.md`](docs/part-3-data-engineering.md) | Documented |
| Part 5 — LLM / AI Integration | [`docs/part-5-llm-integration.md`](docs/part-5-llm-integration.md) | Documented |
| Data Generator (supporting) | [`docs/data-generator.md`](docs/data-generator.md) | Drafted |

## Repository Structure

```
FortheaAssesment/
├── docs/                 # Design documents (Sections 1-3, 5) and supporting docs
│   ├── part-1-architecture.md
│   ├── part-2-backend.md
│   ├── part-3-data-engineering.md
│   ├── part-5-llm-integration.md
│   └── data-generator.md
├── backend/              # Section 2 — FastAPI service
├── frontend/             # Section 4 — Next.js dashboard
├── docker-compose.yml    # Local dev stack (backend + frontend + db)
└── README.md
```

_Section folders are scaffolded; code is added in its respective phase. IaC is documented only — see [`docs/part-1-architecture.md`](docs/part-1-architecture.md) §6._
