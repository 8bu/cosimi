#!/usr/bin/env bash
# Preflight + run the cosimi dev stack.
#
# Chain:
#   1. docker daemon guard (fail fast if Docker isn't reachable)
#   2. db:up --wait (compose postgres service; bake-in --wait makes this idempotent)
#   3. migrate (idempotent — applies anything new, no-op if up-to-date)
#   4. exec `turbo run dev` scoped to the cosimi playgrounds (api + admin-api +
#      web + admin) — NOT apps/portf (its own dev:portf), which would also bind 3000.
#
# All steps short-circuit on failure (`set -e`). GraphRAG content comes from the
# offline ingest pipeline (admin → Ingest), not seed files — there is no seed step.
# Embeddings need a local ollama with bge-m3 (`ollama serve` + `ollama pull bge-m3`).

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! docker info > /dev/null 2>&1; then
  echo "Docker daemon not reachable. Start Docker Desktop (or colima) and re-run pnpm dev:cosimi." >&2
  exit 1
fi

# `pnpm db:up` runs `docker compose up -d --wait`. When invoked from a git
# worktree, compose computes a project name from the cwd that differs from
# the main repo's project name; the postgres container has a hardcoded
# `container_name: cosimi-postgres` so the second project errors with a
# name conflict even though the container is healthy. Skip the up call
# entirely when the container is already running — compose `up` is a
# no-op semantically once the container is healthy.
if docker ps --filter name=cosimi-postgres --filter status=running --format '{{.Names}}' | grep -q '^cosimi-postgres$'; then
  echo "postgres container already running — skipping db:up"
else
  pnpm db:up
fi

pnpm migrate

exec turbo run dev --filter='./playgrounds/*'
