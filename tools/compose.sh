#!/usr/bin/env bash
# `docker compose` where the plugin works, the standalone `docker-compose`
# otherwise — Colima installs ship the latter, and a stale Docker Desktop
# symlink can leave the plugin present but dead.
set -euo pipefail
if docker compose version >/dev/null 2>&1; then
  exec docker compose -f infra/docker-compose.yml "$@"
fi
exec docker-compose -f infra/docker-compose.yml "$@"
