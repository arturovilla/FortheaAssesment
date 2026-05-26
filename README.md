# Forthea Senior Software Engineer Assessment

This repository contains my response to the five-section assessment: architecture design, a Python backend service, a data engineering pipeline, a Next.js dashboard, and an LLM feature design.

## Requirements

The following requirements are extracted from the assessment brief. They are split into **functional requirements** (what the system must do) and **non-functional requirements** (the qualities it must have). Each item is tagged with the section it comes from.

### Functional Requirements

Every requirement is tagged with its status pill. The doc section that
covers it is listed as a sub-bullet underneath.

#### Section 1: Architecture & Systems Design

- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-1.1** Design a multi-tenant analytics system that lets a user monitor and analyze website traffic data for their own website.
  - [Part 1 §2 Multi-Tenancy](frontend/docs/part-1-architecture.md#2-multi-tenancy--tenant-isolation)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-1.2** Source traffic data from Google Analytics 4 (GA4).
  - [Part 1 §3 Data Ingestion](frontend/docs/part-1-architecture.md#3-data-ingestion--flow)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-1.3** Front end built with React / Next.js.
  - [Part 4 §1 Overview](frontend/docs/part-4-frontend.md#1-overview)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-1.4** Backend built with Python or Node.
  - [Part 2 §1 Overview](frontend/docs/part-2-backend.md#1-overview)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-1.5** Persist data into a single unified data warehouse.
  - [Part 1 §4 Unified Data Warehouse](frontend/docs/part-1-architecture.md#4-unified-data-warehouse)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-1.6** Deliver architecture diagrams and detailed written reasoning.
  - [Part 1 §1 High-Level Architecture](frontend/docs/part-1-architecture.md#1-high-level-architecture)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-1.7** Define the pipeline using Infrastructure as Code (IaC).
  - [Part 1 §6 Infrastructure as Code](frontend/docs/part-1-architecture.md#6-infrastructure-as-code)

#### Section 2: Python Backend

- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-2.1** Build a FastAPI service.
  - [Part 2 §1 Overview](frontend/docs/part-2-backend.md#1-overview)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-2.2** Ingest marketing data supplied as JSON.
  - [Part 2 §2.2 The single async ingest pattern](frontend/docs/part-2-backend.md#22-the-single-async-ingest-pattern)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-2.3** Validate incoming data against a schema.
  - [Part 2 §3 Schema Validation](frontend/docs/part-2-backend.md#3-schema-validation)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-2.4** Store validated data to a SQL database.
  - [Part 2 §4 Persistence Layer](frontend/docs/part-2-backend.md#4-persistence-layer)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-2.5** Expose a query endpoint that supports pagination.
  - [Part 2 §5 Query Endpoint Design](frontend/docs/part-2-backend.md#5-the-query-endpoint-design)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-2.6** The query endpoint supports filtering.
  - [Part 2 §5 Query Endpoint Design](frontend/docs/part-2-backend.md#5-the-query-endpoint-design)

#### Section 3: Data Engineering

- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.1** Design a cloud-based pipeline that ingests daily Google Ads and Meta campaign data for active campaigns.
  - [Part 3 §2 Pipeline Architecture](frontend/docs/part-3-data-engineering.md#2-pipeline-architecture--orchestration)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.2** Include orchestration for the pipeline.
  - [Part 3 §2 Pipeline Architecture](frontend/docs/part-3-data-engineering.md#2-pipeline-architecture--orchestration)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.3** Include storage for the ingested data.
  - [Part 3 §3 Storage & Data Modeling](frontend/docs/part-3-data-engineering.md#3-storage--data-modeling)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.4** Include exception handling.
  - [Part 3 §6 Exception Handling](frontend/docs/part-3-data-engineering.md#6-exception-handling--retries)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.5** Include testing.
  - [Part 3 §7 Testing Strategy](frontend/docs/part-3-data-engineering.md#7-testing-strategy)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.6** Document how to connect to the Google Ads API and the Meta API.
  - [Part 3 §4 Google Ads](frontend/docs/part-3-data-engineering.md#4-google-ads-api-connection)
  - [§5 Meta](frontend/docs/part-3-data-engineering.md#5-meta-api-connection)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.7** Provide example API queries that return reports matching the Google Ads and Meta Ads schemas below.
  - [Part 3 §4 Google Ads](frontend/docs/part-3-data-engineering.md#4-google-ads-api-connection)
  - [§5 Meta](frontend/docs/part-3-data-engineering.md#5-meta-api-connection)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.8** Write SQL that builds daily client-level CPA tables.
  - [Part 3 §9 CPA & ROAS SQL](frontend/docs/part-3-data-engineering.md#9-cpa--roas-sql)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.9** Write SQL that builds daily client-level ROAS tables.
  - [Part 3 §9 CPA & ROAS SQL](frontend/docs/part-3-data-engineering.md#9-cpa--roas-sql)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-3.10** Write SQL that detects anomalies in the CPA / ROAS data.
  - [Part 3 §10 Anomaly Detection SQL](frontend/docs/part-3-data-engineering.md#10-anomaly-detection-sql)

#### Section 4: React / Next.js

- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-4.1** Build a dashboard page.
  - [Part 4 §1.4 The two surfaces](frontend/docs/part-4-frontend.md#14-the-two-surfaces)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-4.2** Include a client selector.
  - [Part 4 §2.5 Tenant resolution](frontend/docs/part-4-frontend.md#25-tenant-resolution-the-url--header-dance)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-4.3** Include KPI cards.
  - [Part 4 §4 Component Architecture](frontend/docs/part-4-frontend.md#4-component-architecture)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-4.4** Include a paginated table.
  - [Part 4 §3 Data Fetching Architecture](frontend/docs/part-4-frontend.md#3-data-fetching-architecture)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-4.5** Integrate an external API (e.g. US Census or FRED).
  - [Part 4 §11 External API: FRED](frontend/docs/part-4-frontend.md#11-external-api-fred)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-4.6** Include error boundaries.
  - [Part 4 §8.1 Two layers of error handling](frontend/docs/part-4-frontend.md#81-two-layers-of-error-handling)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-4.7** Include loading states.
  - [Part 4 §8.2 Loading skeletons](frontend/docs/part-4-frontend.md#82-loading-skeletons)

#### Section 5: LLM / AI Integration

- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-5.1** Design and justify an LLM-powered feature (e.g. anomaly explanations or a call-scoring QA layer).
  - [Part 5 §2 The Feature & Its Justification](frontend/docs/part-5-llm-integration.md#2-the-feature--its-justification)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-5.2** Define monitoring for the feature.
  - [Part 5 §5 Monitoring](frontend/docs/part-5-llm-integration.md#5-monitoring)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-5.3** Define guardrails for the feature.
  - [Part 5 §4 Guardrails](frontend/docs/part-5-llm-integration.md#4-guardrails)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **FR-5.4** Define evaluation metrics for the feature.
  - [Part 5 §6 Evaluation Metrics](frontend/docs/part-5-llm-integration.md#6-evaluation-metrics)

### Non-Functional Requirements

- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-1: Multi-tenancy.** The system must isolate data and access per tenant so each user only sees their own website's data. (Section 1).
  - [Part 1 §2 Multi-Tenancy](frontend/docs/part-1-architecture.md#2-multi-tenancy--tenant-isolation)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-2: Cloud strategy.** The pipeline must be Azure-first but portable across clouds (multi-cloud capable). (Sections 1, 3).
  - [Part 1 §5 Azure-First, Multi-Cloud Strategy](frontend/docs/part-1-architecture.md#5-azure-first-multi-cloud-strategy)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-3: Scalability.** The data pipeline must handle roughly 10,000 active Google Ads campaigns and roughly 20,000 active Meta DMA-campaigns per day. (Section 3).
  - [Part 3 §2 Pipeline Architecture](frontend/docs/part-3-data-engineering.md#2-pipeline-architecture--orchestration)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-4: Reliability / SLAs.** The pipeline must meet defined Service Level Agreements. (Section 3).
  - [Part 3 §8 SLAs](frontend/docs/part-3-data-engineering.md#8-slas)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-5: Versioning.** The architecture must support versioning of infrastructure and deployments. (Section 1).
  - [Part 1 §7 Versioning & Rollback](frontend/docs/part-1-architecture.md#7-versioning--rollback)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-6: Rollback.** The architecture must support a rollback strategy. (Section 1).
  - [Part 1 §7 Versioning & Rollback](frontend/docs/part-1-architecture.md#7-versioning--rollback)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-7: Monitoring / observability.** Both the platform (Section 1) and the LLM feature (Section 5) must be monitored.
  - [Part 1 §8 Monitoring](frontend/docs/part-1-architecture.md#8-monitoring--observability)
  - [Part 5 §5 Monitoring](frontend/docs/part-5-llm-integration.md#5-monitoring)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-8: Reproducible infrastructure.** Infrastructure must be defined as code so it is versioned and repeatable. (Section 1).
  - [Part 1 §6 Infrastructure as Code](frontend/docs/part-1-architecture.md#6-infrastructure-as-code)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-9: Data quality.** Ingested data must be schema-validated before storage. (Section 2).
  - [Part 2 §3 Schema Validation](frontend/docs/part-2-backend.md#3-schema-validation)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-10: Query performance.** Query results must be paginated and filterable so responses stay bounded as data grows. (Section 2).
  - [Part 2 §5 Query Endpoint Design](frontend/docs/part-2-backend.md#5-the-query-endpoint-design)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-11: Resilience.** The system must handle failures gracefully: backend exception handling (Section 3) and front-end error boundaries with loading states (Section 4).
  - [Part 3 §6 Exception Handling](frontend/docs/part-3-data-engineering.md#6-exception-handling--retries)
  - [Part 4 §8 Error & Loading States](frontend/docs/part-4-frontend.md#8-error--loading-states)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-12: Testability.** The pipeline must be covered by tests. (Section 3).
  - [Part 3 §7 Testing Strategy](frontend/docs/part-3-data-engineering.md#7-testing-strategy)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-13: AI safety.** The LLM feature must have guardrails and measurable evaluation metrics. (Section 5).
  - [Part 5 §4 Guardrails](frontend/docs/part-5-llm-integration.md#4-guardrails)
  - [§6 Evaluation Metrics](frontend/docs/part-5-llm-integration.md#6-evaluation-metrics)
- <span style="display:inline-block;padding:1px 9px;border:1px solid #a6e3a1;border-radius:9999px;color:#a6e3a1;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Done</span> **NFR-14: Deliverability.** All code, diagrams, and written responses must be submitted in a single GitHub repo or zipped folder within 5 days. (Instructions).
  - Met by this repo

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
| 1: Architecture | Full design doc | (none) | IaC strategy documented in §6; no Terraform code (no cloud accounts) |
| 2: Backend | Full design doc | **Yes, runnable** | FastAPI service with real Clerk auth, Postgres persistence, paginated mart queries |
| 3: Data Engineering | Full design doc | **CPA/ROAS + anomaly SQL** | Pipeline designed, not deployed; SQL is real and runs against Postgres locally |
| 4: Dashboard | (covered by Section 4 requirements) | **Yes, runnable** | Next.js, reads the backend, includes FRED enrichment widget |
| 5: LLM Integration | Full design doc | (none) | Design only; no LLM API calls (avoids paid model traffic for a job application) |
| Data generator | Full doc | **Yes, runnable** | Generates synthetic data for the brief's three schemas across three tenants |

### Deliberately out of scope for the code

- **Airflow orchestrator.** Section 3 territory; designed in the doc, not built.
- **Presigned-URL upload flow.** Documented as the large-payload pattern; direct `POST` satisfies the brief.
- **Snowflake connectivity in code.** Local dev uses Postgres for both operational and analytical state; the Snowflake swap is documented as the production target.
- **Real cloud deployment / Terraform.** No cloud accounts provisioned for the assessment.
- **LLM API calls.** Section 5 is design-only.
- **Real Auth0 wiring.** Clerk is the chosen IdP for the built backend; Auth0 stays documented as the equivalent alternative.

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

**By CAP: this platform is AP** (availability + eventual consistency). In PACELC: **PA/EL**: under partition, choose Availability; otherwise, choose low Latency over strong Consistency. A standard posture for analytical platforms where dashboards must always answer and absolute freshness is not the contract.

## Documentation

The design docs live inside the frontend project so the running dashboard
can render them at `/system-design`. The links below are the same files,
viewable on GitHub.

| Section | Document | Status |
|---------|----------|--------|
| Part 1: Architecture & Systems Design | [`frontend/docs/part-1-architecture.md`](frontend/docs/part-1-architecture.md) | Documented |
| Part 2: Backend (FastAPI) | [`frontend/docs/part-2-backend.md`](frontend/docs/part-2-backend.md) | Documented |
| Part 3: Data Engineering | [`frontend/docs/part-3-data-engineering.md`](frontend/docs/part-3-data-engineering.md) | Documented |
| Part 4: Frontend (Next.js) | [`frontend/docs/part-4-frontend.md`](frontend/docs/part-4-frontend.md) | Documented |
| Part 5: LLM / AI Integration | [`frontend/docs/part-5-llm-integration.md`](frontend/docs/part-5-llm-integration.md) | Documented |
| Data Generator (supporting) | [`frontend/docs/data-generator.md`](frontend/docs/data-generator.md) | Documented |

## Repository Structure

```
FortheaAssesment/
├── backend/                  # Section 2: FastAPI service
├── frontend/                 # Section 4: Next.js dashboard
│   └── docs/                 # Design documents, rendered in-app at /system-design
│       ├── README.md
│       ├── part-1-architecture.md
│       ├── part-2-backend.md
│       ├── part-3-data-engineering.md
│       ├── part-4-frontend.md
│       ├── part-5-llm-integration.md
│       └── data-generator.md
├── docker-compose.yml        # Local dev stack (backend + frontend + db)
└── README.md
```

_Section folders are scaffolded; code is added in its respective phase. IaC is documented only; see [`frontend/docs/part-1-architecture.md`](frontend/docs/part-1-architecture.md) §6._
