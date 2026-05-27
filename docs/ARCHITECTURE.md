# Architecture

Two backend processes, two SPAs, one database:

```
                                                       ┌───────────────┐
   ┌──────────────┐    /api/* (Vite)    ┌──────────┐   │               │
   │  apps/web    │ ──────────────────▶ │ apps/api │ ─▶│  Postgres 16  │
   │  (chat UI)   │ ◀── SSE stream ──── │  :3000   │ ─▶│  + pg_trgm    │
   │   :5173      │                     │  0.0.0.0 │   │  + unaccent   │
   └──────────────┘                     └──────────┘   │               │
                                                       │               │
   ┌──────────────┐    /api/* (Vite)  ┌────────────┐   │               │
   │  apps/admin  │ ────────────────▶ │ admin-api  │ ─▶│               │
   │  (internal)  │                   │  :3001     │   │               │
   │   :5174      │                   │  127.0.0.1 │   │               │
   └──────────────┘                   └────────────┘   └───────────────┘
            ▲                              ▲
    operator browser              loopback bind only
    (via VPN/Tailscale)           (no app-layer auth)
```

- **`apps/api`** owns chat, `/teach` (inline command), feedback, public stats, health, runs GC sweeper. Binds `0.0.0.0:PORT` — public.
- **`apps/admin-api`** owns admin surface: pairs CRUD, teach-queue review, bulk LLM import, batch rollback. **Binds `127.0.0.1:ADMIN_PORT` by default.** No `/admin/*` prefix server-side — whole process is admin surface.
- Both share `@simlm/{db, types, config, normalizer, logger}`.

## How matching works

Matcher cascades four tiers, short-circuits on first non-null:

1. **`session_teach`** — recent in-session `/teach` overrides (10-min TTL). User corrects wrong reply immediately, no admin wait.
2. **`exact`** — normalized + diacritic-stripped equality (Postgres `f_unaccent()` both sides).
3. **`fts`** — Postgres `tsvector` rank against `simple` text-search config; gated by `MATCH_FTS_MIN`.
4. **`trigram`** — `pg_trgm` similarity; gated by `MATCH_TRGM_MIN` (`%` index operator AND explicit similarity filter — see [`../CLAUDE.md`](../CLAUDE.md) why both required).

If all four miss, bot replies with locale's `fallback_message_*` from `app_config` and input added to `unanswered` so operator teach later. Within winning tier, matcher picks randomly from top-K rows (`MATCH_TOP_K`, default 5) so back-to-back identical queries no always return same canned answer.

## Repo layout

```
apps/
  api/         # public Hono REST + SSE, binds PORT on 0.0.0.0, runs GC
  admin-api/   # internal Hono REST, binds ADMIN_PORT on 127.0.0.1
  web/         # public chat UI (Vite + React + Tailwind v4)
  admin/       # internal admin dashboard (Vite + React + Tailwind v4)
packages/
  config/      # valibot env schema
  types/       # shared DTOs
  normalizer/  # pure NFC + case + whitespace
  db/          # postgres client, migrations, repositories
  matcher/     # 4-tier matching engine
  logger/      # pino + redactInput()
  ui-tokens/   # pure-CSS design tokens (incl. [data-theme="dark"]
               # override) shared by apps/web and apps/admin
  template/    # {{ var }} placeholder renderer for app_config
  branding/    # shared brand name + helpers
  tsconfig/    # shared tsconfig bases
  oxlint-config/ # shared oxlint ruleset
seeds/
  vi/          # hand-curated Vietnamese seeds
  chatterbot/  # snapshot of chatterbot-corpus (BSD-3, see NOTICE)
docs/          # phased specs, requirements, LLM import format
```

See [`../CLAUDE.md`](../CLAUDE.md) for conventions, invariants, "don't-repeat-this-mistake" rules accreted across phased build.