# Forthea Assessment — Setup

## Prerequisites

- Docker (with Compose)
- Python 3.12+
- A [Clerk](https://clerk.com) account and a [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) API key — both free. Only needed if you want the auth and `/macro` endpoints to work end to end.

## One-time setup

From the repo root:

```bash
cd backend
python3 -m venv .
source bin/activate
pip install -r requirements.txt
cp .env.example .env.local                     # then fill in CLERK_* and FRED_API_KEY
cd ..
```

The venv is shared by the FastAPI app, alembic, the helper scripts, and the data generator at `backend/data-generator/`.

## Bring the stack up

From the repo root, with the venv active (`source backend/bin/activate`):

```bash
docker compose up -d db                                          # start Postgres
(cd backend && alembic upgrade head)                             # apply migrations
(cd backend/data-generator && python datagen.py && python load.py)  # seed data
docker compose up -d --build backend                             # build + start FastAPI
curl http://localhost:8000/health
```

That's the whole thing. Total ~30 seconds on a warm Docker cache.

## Shut it down

```bash
docker compose down            # stops containers; db data persists in the volume
docker compose down -v         # also wipes the db (you'll need to re-run alembic + load)
```

## Optional: minting a JWT for curl tests

Real endpoint calls need a Clerk JWT. One-time setup in the Clerk dashboard:

1. **JWT Templates → + New template**, name it `forthea`, claims:
   ```json
   {
     "tenant_id": "{{user.public_metadata.tenant_id}}",
     "tenants":   "{{user.public_metadata.tenants}}",
     "email":     "{{user.primary_email_address.email_address}}"
   }
   ```
   Bump **Token lifetime** to `3600` so tokens don't expire mid-curl.
2. **Users → + Create user**, then on the user page set **Public metadata** to `{"tenant_id":"apple","tenants":["apple"]}` (or `google`/`disney`).

Then mint a token and call any endpoint:

```bash
cd backend && source bin/activate
TOKEN=$(python -m scripts.get_test_token --email you@example.com) && \
  curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/clients | jq
```
