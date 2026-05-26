# Forthea Assessment Setup

## Prerequisites

- Docker (with Compose)
- `backend/.env.local` and `frontend/.env.local` with Clerk + FRED credentials. Both folders ship an `.env.example` to copy from.

## Demo video

A short walkthrough of the running app: [view on Google Drive](https://drive.google.com/drive/folders/1mnnAtq8xRsmH6NwlBB2gdXwWQjLOqKxj?usp=sharing). Anyone with the link can view.

## Start the stack

From the repo root:

```bash
./start.sh
```

The script:

1. Stops any running Forthea containers for a clean slate.
2. Sources `frontend/.env.local` so the Next.js build args get the right values (Clerk publishable key, API base URL).
3. Builds all three images (db, backend, frontend).
4. Starts every container detached.

When it finishes:

- **Dashboard:** http://localhost:3000
- **Backend API:** http://localhost:8000 (Swagger UI at `/docs`)
- **Postgres:** localhost:5432

## Working with data

Once the stack is up, there are three paths depending on what you want to do. All of them run inside the backend container via `docker exec`, so you don't need Python on the host.

### Seed the database (fast path)

Generate fresh synthetic data and bulk-load every tenant's tables in one transaction. Fully populated dashboard in seconds. Use this for a quick demo or when you don't care about exercising the upload flow.

```bash
docker exec -it forthea-backend python data-generator/datagen.py
docker exec -it forthea-backend python data-generator/load.py
```

### Clear out the database

Wipe every marketing-data row and re-seed only the `tenants` registry (the FK target every tenant-scoped table references). After this, the dashboard shows empty states everywhere; that's your cue the wipe worked.

```bash
docker exec -it forthea-backend python data-generator/load.py --bootstrap
```

### Test the JSON upload flow

Generate fresh JSON, copy it out of the container, then upload the files through the dashboard's **Upload data** button. This exercises the full async ingest path (initiate, PUT to blob, commit, poll) instead of bulk-loading.

```bash
# 1. Generate per-tenant JSON files inside the container.
docker exec -it forthea-backend python data-generator/datagen.py

# 2. Copy the output directory to where you're running this command.
docker cp forthea-backend:/app/data-generator/output ./data-output
```

The files land at `./data-output/<tenant>/`. Sign in to the dashboard as each tenant (or as a multi-tenant admin user, switching via the tenant selector) and upload that tenant's three files **in this order**:

1. **`clients.json`** (type `clients`). Must go first, because the CPA / ROAS marts join the ads tables to `dim_client`. Without it, the dashboard stays empty even after the ads files land.
2. **`google_ads.json`** (type `google_ads`).
3. **`meta.json`** (type `meta`).

The dialog walks the four-step async flow (initiate → PUT to blob → commit → poll); when the poll comes back `succeeded`, the dashboard repaints automatically.

## Stop the stack

```bash
docker compose down            # stops containers; db data persists in the volume
docker compose down -v         # also wipes the db volume
```

## Demo users

Four pre-configured Clerk users are available for the demo. Sign in at http://localhost:3000 with any of them.

| Role | Email | Password | Tenants |
|------|-------|----------|---------|
| Admin (agency staff) | `admin@forthea.com` | `jazvit-jozhy9-Hywnyv` | apple, google, disney |
| Disney | `wdisney@disney.com` | `bargix-zagzUm-dowjy1` | disney |
| Google | `timgoogle@google.com` | `wuFtaz-ziqtyn-8bubce` | google |
| Apple | `timcook@apple.com` | `hekfez-pygzuw-maVdo4` | apple |

The admin user sees the tenant selector dropdown (multi-tenant agency staff view). The three tenant users see a read-only chip pinned to their tenant and can't switch.
