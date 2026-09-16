#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# All deploys are manual, and all of them are Cloudflare: Cloudflare Pages for
# the lab (`cosimi-web`) and a Cloudflare Worker for `cosimi-api`, which reaches
# Neon through the `cosimi-hd` Hyperdrive config. First-time setup — creating the
# Pages project `cosimi-web`, the Hyperdrive config `cosimi-hd`, and the custom
# domain — is done once in the Cloudflare dashboard or CLI and is not automated
# here.

# -- output helpers ---------------------------------------------------------
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'
print_success() { printf '%s\n' "${GREEN}✓ $*${NC}"; }
print_error()   { printf '%s\n' "${RED}✗ $*${NC}" >&2; }
print_warning() { printf '%s\n' "${YELLOW}! $*${NC}"; }
print_info()    { printf '%s\n' "${BLUE}» $*${NC}"; }

# shellcheck disable=SC2086  # word-splitting the command prefix is intentional
WRANGLER="pnpm --filter @cosimi/api exec wrangler"

run_gates() {
  print_info "Running standing gates…"
  pnpm -r typecheck \
    && pnpm lint \
    && pnpm format:check \
    && pnpm -r --workspace-concurrency=1 test
  print_success "Gates green."
}

confirm() {
  local reply
  read -rp "$1 [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

# -- deploy bodies (no gates) ----------------------------------------------

deploy_lab_pages() {
  print_info "Building @cosimi/lab…"
  pnpm --filter @cosimi/lab build
  print_info "Deploying lab → Pages (cosimi-web)…"
  # shellcheck disable=SC2086
  $WRANGLER pages deploy "$(pwd)/playgrounds/lab/dist" --project-name cosimi-web --commit-dirty=true
  print_success "Lab deployed to cosimi-web."
}

deploy_api_worker() {
  print_info "Deploying cosimi-api Worker (env.cosimi)…"
  (cd playgrounds/api && pnpm exec wrangler deploy -e cosimi)
  print_success "cosimi-api deployed."
}

# -- steps ------------------------------------------------------------------

step_deploy_lab() {
  run_gates
  deploy_lab_pages
}

step_deploy_api() {
  run_gates
  deploy_api_worker
}

step_deploy_both() {
  run_gates
  deploy_lab_pages
  deploy_api_worker
  print_success "Full deploy complete."
}

step_migrate() {
  local url
  printf 'Neon cosimi DIRECT connection URL (not -pooler): '
  read -rs url; printf '\n'
  if [[ -z "$url" ]]; then print_error "Empty URL — aborting."; return 1; fi
  print_info "Running migrations against the cosimi DB…"
  DATABASE_URL="$url" pnpm --filter @cosimi/db-core migrate up
  unset url
  print_success "Migrations applied."
}

step_tail() {
  (cd playgrounds/api && pnpm exec wrangler tail -e cosimi)
}

step_status() {
  print_info "Cloudflare account:"
  # shellcheck disable=SC2086
  $WRANGLER whoami || true
  printf '\n'
  print_info "cosimi-api deployments:"
  # shellcheck disable=SC2086
  $WRANGLER deployments list -e cosimi || true
  printf '\n'
  print_info "cosimi /healthz:"
  curl -fsS https://cosimi.8bu.dev/api/healthz || print_warning "cosimi health unreachable"
  printf '\n'
}

menu() {
  cat <<'MENU'

cosimi deploy - Cloudflare + Neon (manual)
  1) Run gates
  2) Deploy lab → Pages (cosimi-web)
  3) Deploy cosimi-api Worker (env.cosimi)
  4) Deploy both (gates → 2,3)
  5) Migrate Neon cosimi DB
  6) Tail cosimi-api
  7) Status
  q) Quit
MENU
  printf 'Choose: '
}

run_choice() {
  case "$1" in
    1) run_gates ;;
    2) step_deploy_lab ;;
    3) step_deploy_api ;;
    4) confirm "Deploy the lab AND the cosimi-api Worker to production?" && step_deploy_both ;;
    5) step_migrate ;;
    6) step_tail ;;
    7) step_status ;;
    q|Q|quit|exit) print_info "Bye."; exit 0 ;;
    *) print_error "Invalid choice: $1"; return 1 ;;
  esac
}

main() {
  local choice="${1:-}"
  # An option number passed as $1 runs that step once and exits; otherwise menu.
  if [[ -n "$choice" ]]; then
    run_choice "$choice"
    return
  fi
  while true; do
    menu
    read -r choice
    run_choice "$choice" || true
  done
}

main "$@"
