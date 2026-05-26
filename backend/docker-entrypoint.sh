#!/bin/sh
# Entrypoint for the backend container.
#
# Applies any pending alembic migrations, then execs whatever was passed as
# CMD (uvicorn by default; can be overridden for one-off jobs).
#
# `alembic upgrade head` is idempotent: a no-op when the DB is already at
# the latest revision, so running it on every container start is safe and
# costs ~100ms on a warm DB.
#
# Compose's `depends_on: db: condition: service_healthy` guarantees Postgres
# is reachable before this script runs, so we don't need a retry loop.

set -e

echo "==> Applying database migrations"
alembic upgrade head

echo "==> Starting: $*"
exec "$@"
