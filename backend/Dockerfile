# syntax=docker/dockerfile:1.7
#
# FastAPI backend image.
#
# What goes in:    alembic/, alembic.ini, app/, scripts/, requirements.txt,
#                  data-generator/ (source only, so it can be run via
#                  `docker exec -it forthea-backend python data-generator/...`)
# What stays out:  bin/, lib/, ...  (the venv that lives at backend/ root)
#                  .env, .env.local (secrets, passed via env at runtime)
#                  data-generator/output/ (generated JSON, bind-mounted instead)
#                  See .dockerignore for the full list.
#
# Default command runs uvicorn. For the migration job (Part 2 §6, prod path),
# override with: `command: alembic upgrade head` in your orchestrator.

FROM python:3.12-slim

# Set a working directory the non-root user can own.
WORKDIR /app

# System: only what psycopg's pure-Python fallback needs. `psycopg[binary]`
# ships its own libpq, so we don't install libpq5/libpq-dev. If you switch
# to plain `psycopg` (no binary extras), add libpq-dev + build-essential here.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first so the layer caches across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy production code only. .dockerignore drops everything that doesn't ship.
COPY alembic.ini      ./alembic.ini
COPY alembic/         ./alembic/
COPY app/             ./app/
COPY scripts/         ./scripts/
COPY data-generator/  ./data-generator/

# Run as a non-root user — minor but standard production hygiene.
RUN useradd -m -u 1000 app && chown -R app:app /app
USER app

EXPOSE 8000

# Liveness + DB reachability; orchestrators (Kubernetes, ECS, docker-compose)
# use this to decide when the container is ready for traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
