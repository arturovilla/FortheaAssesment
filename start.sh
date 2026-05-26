#!/usr/bin/env bash
# start.sh — bring the full Forthea stack up from scratch.
#
# Steps:
#   1. Stop any running containers that match our container names.
#   2. Build all images.
#   3. Run all containers.
#
# Run from anywhere; this script cd's to its own directory first.

set -euo pipefail

# Resolve repo root regardless of where the script was invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Container names from docker-compose.yml. Keep in sync when adding services.
CONTAINERS=(forthea-db forthea-backend forthea-frontend)

# -----------------------------------------------------------------------------
# Step 1: stop any running containers matching our names.
#
# `docker compose down` handles the compose-managed lifecycle cleanly (stops
# containers, removes orphaned networks, leaves the db volume alone). The
# per-name `rm -f` afterwards is belt-and-suspenders for stale containers
# that weren't started through compose (e.g. left over from a prior run with
# a different compose file).
# -----------------------------------------------------------------------------
echo "==> 1/3  Stopping any running containers (${CONTAINERS[*]})"
docker compose down --remove-orphans 2>/dev/null || true
for name in "${CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -qx "${name}"; then
    docker rm -f "${name}" >/dev/null
    echo "        removed leftover container: ${name}"
  fi
done

# -----------------------------------------------------------------------------
# Build prep: NEXT_PUBLIC_* vars must be in the SHELL environment so compose
# can substitute them into the frontend build args. Without this, the build
# uses the defaults and Clerk silently fails to initialise in the browser.
# Sourced quietly so this script stays "just works".
# -----------------------------------------------------------------------------
if [ -f frontend/.env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source frontend/.env.local
  set +a
else
  echo "WARNING: frontend/.env.local not found; Clerk + API vars will fall back to defaults"
fi

# -----------------------------------------------------------------------------
# Step 2: build all images.
# -----------------------------------------------------------------------------
echo "==> 2/3  Building images"
docker compose build

# -----------------------------------------------------------------------------
# Step 3: run all containers (detached).
# -----------------------------------------------------------------------------
echo "==> 3/3  Starting containers"
docker compose up -d

echo
echo "✓ Stack is up."
echo "    frontend: http://localhost:3000"
echo "    backend:  http://localhost:8000"
echo "    db:       localhost:5432"
