#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

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
    && pnpm -r --workspace-concurrency=1 test \
    && pnpm --filter @portf/web build \
    && pnpm --filter @portf/web test:ssg
  print_success "Gates green."
}

confirm() {
  local reply
  read -rp "$1 [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

spike() {
  print_warning "Veto gate: proves postgres.js → Hyperdrive → Neon before trusting the real worker."
  print_info "Deploying spike worker…"
  (cd apps/api && pnpm exec wrangler deploy -c spike/wrangler.spike.toml)
  print_info "Invoke the printed workers.dev URL and confirm {\"ok\":true,\"paramOk\":true}."
  print_warning "If paramOk=false with a prepared-statement error, set prepare:false in @cosimi/db before real deploy."
}

deploy_portf_pages() {
  run_gates
  print_info "Building @portf/web…"
  pnpm --filter @portf/web build
  print_info "Deploying portf → Pages…"
  # shellcheck disable=SC2086
  $WRANGLER pages deploy ../portf/dist/client --project-name portf
  print_success "portf Pages deployed."
}

deploy_web_pages() {
  run_gates
  print_info "Building @cosimi/web…"
  pnpm --filter @cosimi/web build
  print_info "Deploying web → Pages…"
  # shellcheck disable=SC2086
  $WRANGLER pages deploy ../web/dist --project-name cosimi-web
  print_success "web Pages deployed."
}

deploy_portf_api() {
  run_gates
  print_info "Deploying portf-api Worker (env.portf)…"
  (cd apps/api && pnpm exec wrangler deploy -e portf)
  print_success "portf-api deployed."
}

deploy_cosimi_api() {
  run_gates
  print_info "Deploying cosimi-api Worker (env.cosimi)…"
  (cd apps/api && pnpm exec wrangler deploy -e cosimi)
  print_success "cosimi-api deployed."
}

deploy_all() {
  run_gates
  pnpm --filter @portf/web build
  # shellcheck disable=SC2086
  $WRANGLER pages deploy ../portf/dist/client --project-name portf
  pnpm --filter @cosimi/web build
  # shellcheck disable=SC2086
  $WRANGLER pages deploy ../web/dist --project-name cosimi-web
  (cd apps/api && pnpm exec wrangler deploy -e portf && pnpm exec wrangler deploy -e cosimi)
  print_success "Full deploy complete."
}

run_migrations() {
  local target db_url
  local -a targets
  printf 'Migrate which DB? [1] portf  [2] cosimi  [3] both: '
  read -r target
  case "$target" in
    1) targets=("portf") ;;
    2) targets=("cosimi") ;;
    3) targets=("portf" "cosimi") ;;
    *) print_error "Invalid choice."; return 1 ;;
  esac
  for t in "${targets[@]}"; do
    print_info "Paste the Neon DIRECT (non-pooled) URL for the ${t} DB (input hidden):"
    read -rsp "  ${t} DATABASE_URL: " db_url; printf '\n'
    if [[ -z "$db_url" ]]; then print_error "Empty URL — skipping ${t}."; continue; fi
    print_info "Running migrations against ${t}…"
    DATABASE_URL="$db_url" node_modules/.bin/tsx packages/db/src/migrate.ts up
    print_success "Migrations applied to ${t}."
    unset db_url
  done
}

tail_logs() {
  local choice
  printf 'Tail which worker? [1] portf-api  [2] cosimi-api: '
  read -r choice
  case "$choice" in
    1) (cd apps/api && pnpm exec wrangler tail -e portf) ;;
    2) (cd apps/api && pnpm exec wrangler tail -e cosimi) ;;
    *) print_error "Invalid choice." ;;
  esac
}

status() {
  # shellcheck disable=SC2086
  { print_info "wrangler account:"; $WRANGLER whoami || true; }
  # shellcheck disable=SC2086
  { print_info "Pages projects:"; $WRANGLER pages project list || true; }
  print_info "portf /healthz:";   curl -fsS https://8bu.dev/api/healthz || print_warning "portf health unreachable"
  printf '\n'
  print_info "cosimi /healthz:";  curl -fsS https://cosimi.8bu.dev/api/healthz || print_warning "cosimi health unreachable"
  printf '\n'
}

menu() {
  cat <<'MENU'

cosimi deploy - Cloudflare + Neon (manual)
  1) Spike: prove Neon + Hyperdrive (SELECT 1)
  2) Deploy portf  → Pages (8bu.dev)
  3) Deploy web    → Pages (cosimi.8bu.dev)
  4) Deploy portf-api  → Worker (env.portf)
  5) Deploy cosimi-api → Worker (env.cosimi)
  6) Deploy ALL (gates → 2,3,4,5)
  7) Run Neon migrations
  8) Tail logs
  9) Status
 10) Run standing gates only
  0) Exit
MENU
  printf 'Choose: '
}

main() {
  local choice
  while true; do
    menu
    read -r choice
    case "$choice" in
      1) spike ;;
      2) deploy_portf_pages ;;
      3) deploy_web_pages ;;
      4) deploy_portf_api ;;
      5) deploy_cosimi_api ;;
      6) confirm "Deploy EVERYTHING to production?" && deploy_all ;;
      7) run_migrations ;;
      8) tail_logs ;;
      9) status ;;
      10) run_gates ;;
      0) print_info "Bye."; exit 0 ;;
      *) print_error "Invalid choice." ;;
    esac
  done
}

main "$@"
