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

echo "==> Running tests"
# `set -e` already aborts on non-zero exit, so a failing test stops the
# container before uvicorn ever binds. That's intentional: a backend that
# doesn't pass its own contract tests should not accept traffic.
pytest tests/ -q

echo "==> Applying database migrations"
alembic upgrade head

echo "==> Starting: $*"
exec "$@"
