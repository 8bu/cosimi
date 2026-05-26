# simlm — SimSimi-style chatbot

A pattern-matching chatbot in the spirit of SimSimi. **No LLM at runtime** —
replies come from a curated/learned pattern store, scored by a four-tier
matching engine (`session_teach → exact → FTS → trigram`). Vietnamese and
English seed data ship in-tree. The repo is a pnpm + Turbo monorepo so the
public chat API, the internal admin API, and the two SPAs share typed
packages.

## Architecture

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

- **`apps/api`** owns chat, `/teach` (inline command), feedback, public stats,
  health, and runs the GC sweeper. Binds `0.0.0.0:PORT` — public.
- **`apps/admin-api`** owns the admin surface: pairs CRUD, teach-queue review,
  bulk LLM import, batch rollback. **Binds `127.0.0.1:ADMIN_PORT` by default.**
  No `/admin/*` prefix server-side — the entire process is the admin surface.
- Both share `@simlm/{db, types, config, normalizer, logger}`.

### How matching works

The matcher cascades through four tiers and short-circuits on the first
non-null result:

1. **`session_teach`** — recent in-session `/teach` overrides (10-min TTL).
   Lets a user correct a wrong reply immediately without waiting for an admin.
2. **`exact`** — normalized + diacritic-stripped equality (Postgres
   `f_unaccent()` on both sides).
3. **`fts`** — Postgres `tsvector` rank against the `simple` text-search
   config; gated by `MATCH_FTS_MIN`.
4. **`trigram`** — `pg_trgm` similarity; gated by `MATCH_TRGM_MIN`
   (`%` index operator AND an explicit similarity filter — see
   [`CLAUDE.md`](./CLAUDE.md) for why both are required).

If all four tiers miss, the bot replies with the locale's `fallback_message_*`
from `app_config` and the input is added to `unanswered` so an operator can
teach a response later. Within the winning tier, the matcher picks randomly
from the top-K rows (`MATCH_TOP_K`, default 5) so back-to-back identical
queries don't always return the same canned answer.

## Setup

Prerequisites: Node 22, Docker (for Postgres), and corepack.

```bash
git clone <repo>
cd simlm
nvm use                 # or: nvm install 22 && nvm use 22
corepack enable         # pnpm version is pinned via packageManager

pnpm install
cp .env.example .env    # defaults are good for local dev

# One-button start: guards Docker, brings up Postgres (waits for
# healthcheck), runs migrations, starts api + admin-api + web via turbo.
pnpm dev:all

# Then in a second terminal, start the admin SPA:
pnpm --filter @simlm/admin dev
```

The first time you boot, the matcher has nothing to match against. Seed it:

```bash
pnpm seed               # loads seeds/vi/*.yaml + seeds/chatterbot/*.yml
# …or selectively:
pnpm seed:vi
pnpm seed:chatterbot
```

To start clean (drops the Postgres volume):

```bash
pnpm db:reset && pnpm migrate && pnpm seed
```

## Configuration

All env vars are parsed by `@simlm/config` (valibot). Defaults are in
parentheses; see [`packages/config/src/index.ts`](./packages/config/src/index.ts)
for the schema.

| Var | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `DATABASE_URL` | *required* | Postgres connection string |
| `PORT` | `3000` | Public api port (binds `0.0.0.0`) |
| `ADMIN_PORT` | `3001` | Admin api port |
| `ADMIN_HOST` | `127.0.0.1` | Admin api bind host — see [Deployment security](#deployment-security) |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `GC_INTERVAL_MS` | `300000` | Sweeper period for expired sessions / session_teaches |
| `SESSION_TTL_HOURS` | `24` | Session lifetime |
| `SESSION_TEACH_TTL_MINUTES` | `10` | In-session teach override lifetime |
| `MATCH_FTS_MIN` | `0.1` | FTS `ts_rank` threshold |
| `MATCH_TRGM_MIN` | `0.4` | Trigram similarity threshold |
| `MATCH_TOP_K` | `5` | Random pick from top-K within the winning tier |
| `EXPOSE_MATCH_INSIGHTS` | `false` | Include tier/score in `/chat` metadata events |
| `SSE_DELAY_MODE` | `token` | `char` \| `token` pacing for streamed replies |
| `SSE_DELAY_BASE_MS` | `30` | Base delay between SSE chunks |
| `SSE_DELAY_JITTER_MS` | `20` | Random jitter added to each chunk delay |
| `TEACH_RATE_LIMIT_PER_HOUR` | `10` | `/teach` calls per session per hour |
| `TEACH_MAX_LENGTH` | `500` | Max chars in a `/teach` payload |
| `TEACH_BLOCKLIST_REGEX` | *empty* | Optional pattern that rejects teach payloads |
| `FALLBACK_MESSAGE` | `hmm idk, tell me more?` | Last-resort no-match reply |
| `PRUNE_SCORE_THRESHOLD` | `-3` | Net-vote threshold below which a pair is considered prune-worthy |

`FALLBACK_MESSAGE` is the **last resort**. The chat handler first reads
`app_config['fallback_message_<locale>']` and falls back to
`app_config['fallback_message_und']` before reaching the env default. Add a
new locale's fallback via a single `INSERT INTO app_config` migration; never
edit migration 010 in place.

## API recipes (port 3000)

```bash
# Chat (SSE — streams session → metadata → token… → done)
curl -N -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"xin chào"}'

# Same session, second turn (echoes session id via response header)
curl -N -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -H 'x-session-id: <uuid from prior response>' \
  -d '{"message":"how are you?"}'

# Inline teach (after a turn that got "I don't know")
curl -N -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -H 'x-session-id: <uuid>' \
  -d '{"message":"/teach pretty good, thanks!"}'

# Feedback (thumbs)
curl -X POST http://localhost:3000/feedback \
  -H 'content-type: application/json' \
  -H 'x-session-id: <uuid>' \
  -d '{"pair_id": 42, "value": 1}'

# Public stats
curl http://localhost:3000/stats

# Health (DB ping with 1s budget; 503 when Postgres is down)
curl http://localhost:3000/healthz
```

## Admin recipes (port 3001, 127.0.0.1)

> Admin endpoints live on a **separate process** at `127.0.0.1:3001`. There
> is no `/admin/*` prefix — the entire process is the admin surface (see
> [Deployment security](#deployment-security)).

```bash
# Top unanswered prompts
curl http://127.0.0.1:3001/unanswered

# Add a pair directly (bypasses the teach queue + atomically clears
# matching unanswered rows server-side)
curl -X POST http://127.0.0.1:3001/pairs \
  -H 'content-type: application/json' \
  -d '{"input":"hi","response":"hello!","topic":"greetings"}'

# Approve a single queued teach
curl -X POST http://127.0.0.1:3001/teach-queue/7/approve

# Bulk approve / reject
curl -X POST http://127.0.0.1:3001/teach-queue/batch \
  -H 'content-type: application/json' \
  -d '{"ids":[1,2,3,4,5],"action":"approve"}'

# List pairs filtered by an import batch
curl 'http://127.0.0.1:3001/pairs?batch_id=42&limit=50'

# LLM bulk import (newline-delimited JSON; one pair per line). Streamed
# server-side so 10k-row imports stay OOM-safe.
curl -X POST "http://127.0.0.1:3001/import?source=llm&topic=humor" \
  -H 'content-type: application/x-ndjson' \
  --data-binary @humor.jsonl
# → { batch_id, count }

# Roll back an import batch (soft-deletes every pair from that batch).
# Re-running with the same body is a no-op; restore individually from
# the Pairs view if needed.
curl -X POST http://127.0.0.1:3001/rollback \
  -H 'content-type: application/json' \
  -d '{"batch_id": 42}'

# Admin process health
curl http://127.0.0.1:3001/healthz
```

For the LLM import file format, see
[`docs/LLM_IMPORT_FORMAT.md`](./docs/LLM_IMPORT_FORMAT.md).

## Deployment security

> 🛑 **The admin API is a separate process with NO authentication.**

`apps/admin-api` runs on its own port and binds to `127.0.0.1` by default,
controlled by `ADMIN_HOST` / `ADMIN_PORT`. Threat model:

- ✅ Public `apps/api` on port `3000` (`0.0.0.0`) — exposes only
  chat / feedback / stats / health.
- ✅ Admin `apps/admin-api` on port `3001` (`127.0.0.1`) — admin surface,
  unreachable from outside the host.
- ⚠️ Setting `ADMIN_HOST=0.0.0.0` exposes the admin surface to anyone on the
  network. The process logs a `warn` line on startup when this happens.
  **Don't do this without a network-layer gate** (Cloudflare Zero Trust, VPN,
  Tailscale, mTLS, etc.) in front. There is no per-route auth — adding it
  would imply the admin routes are safe to expose externally, which is false.

Misconfiguring the *public* API's network (e.g. exposing port 3000 publicly)
does **not** expose admin — different process, different socket, different
port. Security is a property of *where the admin process binds*, not of
route-mounting in code.

## Logging & PII

- `LOG_LEVEL=info` (default) never writes raw `input` / `response` /
  `message` / `reply` fields. Pino's path-based redact strips them as
  `[REDACTED]`, and `redactInput()` (in `@simlm/logger`) is the explicit
  way to log a non-reversible reference: `{ length, hash }`.
- `LOG_LEVEL=debug` lets handlers emit raw values, by convention under
  `*_dbg`-suffixed field names so the redact list doesn't strip them.
- The two backend processes import the same `@simlm/logger` — no divergence
  in PII policy between api and admin-api.

## Development commands

```bash
pnpm dev:all       # one-shot: guards Docker, then db:up (waits for healthy) → migrate → dev
pnpm dev           # turbo: api + admin-api + web
pnpm --filter @simlm/admin dev   # start the admin SPA (port 5174)

pnpm typecheck     # tsc --noEmit across the workspace
pnpm lint          # oxlint
pnpm format        # oxfmt
pnpm format:check  # oxfmt --check
pnpm test          # vitest across all packages
pnpm build         # turbo build

pnpm db:up         # docker compose: Postgres (blocks until healthcheck passes)
pnpm db:down
pnpm db:reset      # drops the volume; combine with migrate + seed for a clean slate

pnpm migrate       # apply pending migrations
pnpm seed          # all seed files
pnpm seed:vi
pnpm seed:chatterbot
```

> ⚠️ The matcher, api, and admin-api test suites all share the
> `simlm_test` database. Run with `pnpm -r --workspace-concurrency=1 test`
> to avoid parallel test-suite setups stomping on each other (see
> [`CLAUDE.md`](./CLAUDE.md) for details).

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

See [`CLAUDE.md`](./CLAUDE.md) for the conventions, invariants, and
"don't-repeat-this-mistake" rules accreted across the phased build.

## Project status

**Complete.** All 16 phases (0–15) are merged on `main`. Test count:
**211 across 8 suites** (api + admin-api + matcher + web + admin +
normalizer + template + i18n). Standing gates green.

Deferred to potential future work — explicitly out of scope for the MVP:

- Internationalization of UI chrome. Chat content is bilingual (vi/en) but
  the admin chrome is English-only. Add when the operator base requires it.
- Multi-user accounts / sharing. The product is single-user-per-browser by
  design (session id in `localStorage`).
- Telemetry / observability dashboards. Pino → stdout → your log pipeline is
  the v1 story. OpenTelemetry would be the natural next step.

## Credits

- Vietnamese seed data: hand-curated.
- English seed data: [chatterbot-corpus](https://github.com/gunthercox/chatterbot-corpus)
  by Gunther Cox, BSD-3 license. See
  [`seeds/chatterbot/LICENSE`](./seeds/chatterbot/LICENSE) and
  [`seeds/chatterbot/NOTICE`](./seeds/chatterbot/NOTICE).
