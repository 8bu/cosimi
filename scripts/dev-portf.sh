#!/usr/bin/env bash
# Preflight + run the portf dev stack.
#
# Chain:
#   1. docker daemon guard
#   2. db:up --wait (shared postgres container with cosimi)
#   3. provision:portf (idempotent CREATE DATABASE portf on the postgres
#      maintenance DB if the portf DB doesn't exist yet — covers the
#      upgrade-in-place case where db/init/01_portf.sql didn't run because
#      the volume already existed)
#   4. migrate:portf (idempotent)
#   5. count active rows in `pairs`; if 0, ask the operator before seeding
#   6. exec `turbo run dev:portf` (fans out to apps/api + admin-api + portf)
#
# Seed is NOT idempotent — running it twice creates duplicate pairs by
# design (each run gets its own import_batches row, which is the rollback
# unit). The prompt-on-empty model means the operator's first run gets a
# clean seed; subsequent runs only re-seed if the corpus was wiped.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! docker info > /dev/null 2>&1; then
  echo "Docker daemon not reachable. Start Docker Desktop (or colima) and re-run pnpm dev:portf." >&2
  exit 1
fi

# See dev-cosimi.sh for the worktree-vs-main project-name conflict that
# makes a naked `pnpm db:up` fail when the container is already healthy.
if docker ps --filter name=cosimi-postgres --filter status=running --format '{{.Names}}' | grep -q '^cosimi-postgres$'; then
  echo "postgres container already running — skipping db:up"
else
  pnpm db:up
fi

pnpm provision:portf
pnpm migrate:portf

count=$(pnpm --silent exec tsx --env-file=.env.portf packages/adapter-postgres/src/scripts/pairs-count.ts)
if [ "$count" = "0" ]; then
  printf "portf pairs table is empty. Seed now (seeds/portf/*.yaml)? (y/N) "
  read -r answer
  case "$answer" in
    [yY]|[yY][eE][sS]) pnpm seed:portf ;;
    *) echo "Skipping seed. Run pnpm seed:portf manually when ready." ;;
  esac
fi

exec turbo run dev:portf
