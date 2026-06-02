# cosimi — Codebase Map for AI Agents

## What this is

SimSimi-style pattern-matching chatbot. **No LLM at runtime** — replies from curated/learned pattern store, scored by 3-tier engine (exact → Postgres FTS → trigram). pnpm + Turbo monorepo; public chat API, internal admin API, two Vite/React UIs share typed packages.

## Tech stack

- **Runtime:** Node.js 22, pnpm 11 (pinned via `packageManager`), Turbo 2.
- **Backend:** Hono.js on Node, Postgres 16 (FTS + `pg_trgm`).
- **Frontend:** Vite + React, Tailwind v4 (CSS-first, no JS config).
- **Tooling:** TypeScript 5.7, oxlint + oxfmt, tsx, valibot, pino, vitest.

## Monorepo layout

Post-SP1: Cosimi is a published `@cosimi/*` SDK constellation + reference apps.

```
packages/                  # the published constellation + private tooling
  sdk/            # @cosimi/sdk — facade createCosimi(config); MatchService; runtime + ./offline entries
  core/           # @cosimi/core — valibot env schema + shared DTOs (merge of former config + types)
  normalizer/     # NFC + lowercase + whitespace (preserves diacritics)
  matcher/        # tier-handler registry (Tier 1 now); adapter-agnostic, takes injected sql
  db-core/        # @cosimi/db-core — repository ports, migrations, migrate CLI, applyMigrations()
  adapter-postgres/ # @cosimi/adapter-postgres — request-scoped/pooled client + repos + seed/provision scripts
  logger/         # pino + redactInput()
  ui-tokens/      # Tailwind v4 @theme tokens (shared CSS, primitives NOT shared)
  tsconfig/ oxlint-config/ branding/ template/   # private tooling (never published)
playgrounds/               # reference apps that consume @cosimi/sdk (NOT published)
  api/         # public Hono REST + SSE, binds PORT on 0.0.0.0; Node + Workers entries
  admin-api/   # internal Hono REST, binds ADMIN_PORT on 127.0.0.1
  web/         # public chat UI (Vite + React + Tailwind v4)
  admin/       # internal admin dashboard (Vite + React)
apps/
  portf/       # portfolio app (TanStack Start); extracted to the 8bu.dev repo in SP3
seeds/
  vi/             # hand-curated Vietnamese seeds
  chatterbot/     # frozen chatterbot-corpus snapshot (SHA-pinned)
docs/
  NEW_ARCHITECTURE.md  # umbrella architecture (SDK era); supersedes the old SPEC_PHASE_* docs
  superpowers/specs|plans/  # per-sub-project specs + plans (gitignored, local working docs)
```

## SDK constellation (SP1)

- **Distribution:** hybrid — `@cosimi/*` code packages publish in lockstep (changesets, npm + JSR); infra drivers (`postgres`, future embedding/storage/LLM clients) are **peerDependencies** the consumer injects, never bundled. See `docs/NEW_ARCHITECTURE.md`.
- **Facade:** `createCosimi(config)` → `CosimiClient`. `config.sql` is the injected postgres **accessor** (resolves Workers request-scoped ALS at call time), so the SDK holds no module-level state and no concrete-adapter dependency — Workers-safe. `playgrounds/api` dogfoods it for the match path.
- **Tier registry:** the match cascade is an ordered `TierHandler[]` (`runCascade` short-circuits on first hit). `tier1Handlers` = session_teach → exact → fts → trigram. Extend (Tier 2/3) by passing `config.tiers`; never edit the core.
- **Ports/adapters:** repository ports live in `@cosimi/db-core`; the postgres adapter implements them. The matcher is adapter-agnostic — `match(sql, opts)` takes the injected accessor.
- **Runtime/offline split:** `@cosimi/sdk` (runtime: match/teach/admin, Workers-safe) vs `@cosimi/sdk/offline` (Node-only SP2 ingest pipeline). Subpath `exports` keep offline (LLM-heavy) deps out of the Workers bundle.
- **Publish is operator-gated:** packages keep `private: true`; go-live = remove private + add per-package dist builds + `jsr.json`, then `pnpm release`.

## Specs

`docs/NEW_ARCHITECTURE.md` is the umbrella (SDK arch + SP1/SP2/SP3 sequencing, with the Tier 2/3 impl reference as the SP2 section). Per-sub-project specs/plans under `docs/superpowers/` (gitignored).

## Commands

- `pnpm dev:all` — Docker guard → `db:up --wait` → `migrate` → `dev`.
- `pnpm dev` — assumes Postgres up + migrated.
- `pnpm db:up` / `db:down` / `db:reset` — Postgres dev container.
- `pnpm migrate` / `seed` / `seed:chatterbot`. Root `migrate` runs `up`; for `status`/`reset` use `pnpm --filter @cosimi/db-core migrate <sub>`.
- `pnpm typecheck` / `lint` / `test` / `build` — turbo fan-out.
- DB tests race when parallel: `pnpm -r --workspace-concurrency=1 test`.

## Conventions

### Workspace & supply chain

- Workspace packages `@cosimi/<name>`, `private: true`. Import via `@cosimi/...`; never relative across packages. `link-workspace-packages=true` makes self-imports work.
- `@cosimi/adapter-postgres` internal subpath imports use `#client`, `#repositories/*`, `#scripts/*`. Outside package, always `@cosimi/adapter-postgres`.
- `pnpm-workspace.yaml` has `minimumReleaseAge: 10080` (7-day embargo). Force-include via `minimumReleaseAgeExclude` only with comment.
- `allowBuilds` = postinstall permission list. Each entry runs arbitrary install-time code; add deliberately with `# why` comment. Current: `esbuild`, `@swc/core`. No wildcards.

### Architecture & security

- `playgrounds/api` and `playgrounds/admin-api` are **separate processes**. admin-api binds `127.0.0.1`; process split + network-layer gate IS auth contract — don't add app-layer auth to admin routes. No `/admin/*` route prefix.
- **No LLM at runtime** in `playgrounds/api`. `@cosimi/matcher` only reply source.
- Env via `loadEnv()` from `@cosimi/core` — called once at startup, never at import time. Never `export const env = loadEnv()` (breaks test env injection). On Cloudflare Workers this is doubly load-bearing: deploy-time startup validation runs global scope with NO bindings, so any import-time `loadEnv()` fails (`DATABASE_URL` absent). The api logger is a lazy `Proxy` for this reason — `loadEnv()`/`createLogger()` only fire on first use, after `worker.ts hoistEnv` bridges the Hyperdrive binding into `process.env.DATABASE_URL`.
- **Workers deploy** (`playgrounds/api` → `portf-api` / `cosimi-api` Workers): the SAME `src/worker.ts` entry; `src/index.ts` is the Node entry. Full runbook + Workers traps in `docs/DEPLOY.md` ("Workers runtime constraints"). Key rule: no module-level DB connection (see Database & migrations). pino logs are invisible to `wrangler tail` — only `console.*` surfaces.

### Database & migrations

- `sql()` from `@cosimi/adapter-postgres` returns a request-scoped client when one is set (Cloudflare Workers), else a process-level singleton pool (Node dev/prod/tests). The Worker entry wraps `fetch`/`scheduled` in `runWithRequestDb(fn)` (an `AsyncLocalStorage` per-request client) because workerd binds each socket to the request that opened it — a shared pool reused across requests throws `Cannot perform I/O on behalf of a different request`. Never create a module-level postgres connection; any new Workers entrypoint touching the DB MUST run inside `runWithRequestDb`. Don't `end()` the request client (a streaming SSE response keeps using it after `app.fetch()` resolves; `idle_timeout` reaps it).
- Migrations in `packages/db-core/migrations/` numbered, additive, **never rewritten after merge**. New changes → new file. `pnpm migrate reset` dev-only (`NODE_ENV !== 'production'`).
- **Canonical write path for `pairs`**: `insertPair` / `insertManyPairs` from `@cosimi/adapter-postgres`. Never raw `INSERT INTO pairs`. Both omit `normalized_unaccented` (Postgres rejects explicit values) and accept optional `tx`; inside `.begin()` MUST pass `tx`.
- `pairs.normalized_unaccented` is `GENERATED ALWAYS AS (f_unaccent(normalized_input)) STORED`. Never INSERT/UPDATE directly.
- **Diacritics split**: `@cosimi/normalizer` does NFC + lowercase + whitespace, **preserves diacritics**. `f_unaccent(text)` (migration 001) strips server-side. All pair tiers compare `pairs.normalized_unaccented` against `f_unaccent(${normalizedInput})`. Never strip in JS. `session_teaches` `f_unaccent`s both sides at query time (no generated column; 10-min TTL keeps small).
- **BIGSERIAL ids round-trip as strings via postgres.js.** Cast at write boundary: `RETURNING id::int AS id`.
- Interval arithmetic in SQL: `${n} * INTERVAL '1 unit'`. Never `(n || ' unit')::interval` (postgres.js types JS numbers as int).
- `app_config` is key/value; templated responses use `{{ key }}` via `renderTemplate(text, vars)` (case-insensitive, unknown keys left literal). Tests exclude `app_config` from TRUNCATE. New placeholder = new migration with `INSERT … ON CONFLICT DO NOTHING`.

### Seeds & batches

- Every seed run creates exactly one `import_batches` row (`createBatch` → `insertManyPairs(..., batch_id)` → `setBatchCount`). Batch IS unit of rollback. Re-seeding creates duplicates by design.
- Seed CLI dispatches by extension: `.json` (array), `.jsonl` (one-per-line), `.yaml`/`.yml` (flat; chatterbot-corpus when top-level `conversations:`/`categories:`, flattened with sliding window). Globs expand shell-side.
- Root scripts (`pnpm seed:vi` etc.) run `tsx packages/db/src/scripts/seed.ts <glob>` from repo root, not `pnpm --filter` — filter would `cd` into package and break globs.
- `seeds/chatterbot/` frozen SHA-pinned snapshot (see `seeds/chatterbot/NOTICE`). Listed in `.oxfmtignore`. No postinstall network fetch.

### Matcher

- Cascade: `session_teach → exact → FTS → trigram`, short-circuit on first non-null. Caller normalizes input (matcher doesn't call `@cosimi/normalizer`). Skip `session_teach` when `sessionId` null.
- All match queries filter `(locale = $1 OR locale = 'und') ORDER BY (locale = $1) DESC`. OR = inclusion (locale-tagged + universal both eligible); ORDER BY = locale-tagged wins ties. Remove either → silent corpus split.
- Trigram tier double-filters: `%` index op **AND** explicit `similarity(...) >= MATCH_TRGM_MIN`. `%` GUC is process-global and mutable; explicit threshold pins behavior. Never replace with `set_limit()`.
- `lowConfidence` ⇔ `tier === 'trigram'`. FTS `ts_rank` clamped to `[0, 1]`. Top-K random pick (`MATCH_TOP_K`, default 5) in JS after SQL ordering — don't push into SQL.

### playgrounds/api: chat + SSE + teach

- `withSession` reads `c.req.json()` once and stashes at `c.set('parsedBody', body)`. Handlers MUST use `c.get('parsedBody')` — Hono body stream single-use. Session id: body → `X-Session-Id` header → minted; echoed in response header.
- SSE: every response ends with literal `data: [DONE]\n\n` from `finally`. `ChatStreamEvent.type === 'done'` for client `switch` exhaustiveness only — `[DONE]` is wire terminator.
- SSE errors: `TeachError.message` user-facing; everything else surfaces as generic with diagnostic logged. `services/rate-limit.ts` throws plain `Error` (circular-import dodge); teach handler rewraps as `TeachError`.
- In-process GC: single `setInterval` (`GC_INTERVAL_MS`, default 5min) DELETEs from `sessions` + `session_teaches` in parallel. Handle is `.unref()`'d. SIGINT/SIGTERM → `stopGc()` → `server.close()`. Multi-instance needs advisory lock; out of scope.
- `/healthz` runs 1s-budgeted DB ping; timeout `.unref()`'d AND cleared in `finally`. Shape: `{ ok, db: 'up'|'down', db_latency_ms, uptime_s }`. Two identical files (api + admin-api) — touch both, or extract on third instance.

### playgrounds/admin-api

- Teach-queue approval uses `insertPair({...}, tx)` inside transaction so queue UPDATE + pair INSERT atomic.
- `/import` JSONL reads `c.req.raw.body!.getReader()` directly to bypass Hono's buffered parser (OOM-safe at 10k rows). `FLUSH_AT=500` bounds in-memory batch.
- `/import` accumulates `Set<string>` of normalized inputs across all flushes (JSONL + buffered JSON), then runs one `DELETE FROM unanswered WHERE normalized_input = ANY(...)` after last flush. Per-request scope, NOT pushed into `insertManyPairs` (seed CLI shouldn't trigger cleanup).
- `POST /pairs` atomically deletes matching `unanswered` rows in same transaction. Match key: `unanswered.normalized_input = normalize(input)`, **no source filter**. Any new write site must include cleanup.
- `/rollback` is `UPDATE pairs SET deleted_at = NOW() WHERE deleted_at IS NULL AND <filters>` — re-runs are no-ops. Soft-delete only. Partial indexes on `deleted_at IS NULL` keep active reads zero-cost.
- `/pairs` PATCH builds SET clauses as conditional `sql` fragments, NOT `sql(obj, ...cols)` — object helper turns `sql\`NOW()\`` into a text literal.
- `/pairs?batch_id=N` is navigation-target-only (no manual input). Set by Import success card via `useSearchParams()`.

### Locale

- Default `'und'` everywhere: `pairs`, `session_teaches`, `teach_queue` all `TEXT NOT NULL DEFAULT 'und'` (migration 010). Don't change without a backfill migration.
- Canonical write path forwards locale: `insertPair` / `insertManyPairs` enumerate it; `teach-handler` stamps it on both `teach_queue` AND `session_teaches` in one transaction; admin-api approval reads queue locale → `insertPair`. Any new write site must thread it through.
- `app_config[fallback_message_<locale>]` is the no-match line. Lookup: `fallback_message_${locales[0]}` → `fallback_message_und` → `env.FALLBACK_MESSAGE`. All pass through `renderTemplate`. New locale fallback = new migration INSERT.
- `useEditPair` does NOT thread `locale` — `AdminPair` has no field, PATCH schema rejects it. Locale stamping is insert-time only.

### Logging

- PII redaction is belt-and-suspenders. `@cosimi/logger.createLogger()` ships a `redact.paths` list (`input`, `response`, `reply`, `message`, `body.message`, `body.reply`, `body.input`); `redactInput(text)` → `{ length, hash: sha256[..8] }`. INFO+: use `redactInput()` if logging text. DEBUG raw values go under `*_dbg` suffixes (escape the redact list).
- App logger files are thin `createLogger('<app>')` re-exports — never construct pino directly. Exception: `playgrounds/api/src/lib/logger.ts` exports a lazy `Proxy` that defers `createLogger()` (hence `loadEnv()`) to first use, so the Workers bundle survives import-time deploy validation (see Architecture & security). Construction is still via `createLogger`, just deferred.

### Tests

- `cosimi_test` is shared by `packages/matcher`, `playgrounds/api`, `playgrounds/admin-api`. Each has its own `vitest globalSetup` that drops `public` and applies every migration. The migration loop is inlined in three places — extract `applyMigrations()` from `migrate.ts` on the fourth.
- DB-touching vitest config: `pool: 'threads'`, `singleThread: true`, `fileParallelism: false`. `pnpm -r --workspace-concurrency=1 test` — otherwise they race. `playgrounds/web` + `playgrounds/admin` are DB-free (jsdom) and parallel-safe.
- `MATCH_FTS_MIN` is `0.01` in matcher tests vs `0.1` in production (short fixtures give sub-0.1 `ts_rank`).
- Fixtures go through `insertManyPairs`, never raw INSERT. Soft-deletion is post-insert `UPDATE … SET deleted_at = NOW()`. `session_teaches` test inserts still use raw SQL (no repo helper yet).
- `playgrounds/api/test/global-setup.ts` pins `SSE_DELAY_*=0` so token pacing doesn't blow timeouts.
- **SSE responses must be drained** in tests before dependent follow-ups — use `drain(res)` / `consumeChatStream(res)` from `playgrounds/api/test/helpers.ts`, even for header-only assertions.
- Web + admin component tests: jsdom + `@testing-library/react` + `userEvent.setup()`. Per-test `cleanup()` in `afterEach` is mandatory (vitest 3 doesn't auto-unmount). Mock via `vi.hoisted` + `vi.mock`, then `await import('@/...')` AFTER the mock.
- `userEvent` deadlocks under `vi.useFakeTimers()` (awaits real timers internally). For fake-timer assertions on native-`<select>` change or post-confirm reload, use `fireEvent.change` / `fireEvent.click`.

### Shared types

- Public-API DTOs live in `@cosimi/core`. Handlers declare `const payload: <T> = …; return c.json(payload)`; clients re-import the same `T` via `apiJson<T>`. Never re-declare client-side.
- LLM bulk-import doc: `docs/LLM_IMPORT_FORMAT.md`. URLs are `http://127.0.0.1:3001/<route>` (no `/admin/*` prefix). Update in lockstep if admin routes reshape. 200-char input/response cap in the doc is advisory; server's valibot cap is 2000.

### playgrounds/web

- Feature-organized: `src/features/<name>/{types,store,tokens,components}`. `routes/` are thin composition shells. `features/chat/` sets the template.
- `apiFetch`'s `raw: true` is load-bearing for streaming endpoints (keeps body un-consumed for `parseSseStream`). JSON endpoints use `apiJson`.
- SSE consumer in `lib/sse-parser.ts`: async generator over `ReadableStream<Uint8Array>` (EventSource is GET-only; we POST). Frames split on `\n\n`; `finally` releases the reader lock. `[DONE]` is the stream-end sentinel.
- `API_BASE = import.meta.env.VITE_API_BASE ?? '/api'`. Default pairs with the Vite proxy strip (`/api/foo` → `:3000/foo`). Override only for cross-origin SPA.
- **Session id is server-canonical.** Client adopts `X-Session-Id` from response. Persisted under `localStorage.cosimi.session` via zustand `persist`. **Never `crypto.randomUUID()` for session ids** — split-brain risk. Local UI ids (React keys) fine to mint client-side.
- Locale read imperatively per turn: `streamChat()` calls `preferencesStore.getState().primaryLocale` and sends `locales: [primary, 'und']`. Mirror for any future per-request server-bound preference (no React reactivity needed off the render tree).
- **Teach detection regex is duplicated server + client; server is canonical.** Server: `PREFIX_RE = /^\/teach\b\s*/i` (`playgrounds/api/src/services/teach-parser.ts`). Client: `TEACH_PREFIX_RE = /^\/teach\b/i` (`playgrounds/web/src/features/chat/tokens.ts`). Change both in the same commit.
- UI message types ≠ API event types. The chat-store reducer bridges SSE events → `ChatMessage` (settled-state union). Components consume `ChatMessage` only.
- UI chrome strings in `src/lib/i18n/<locale>.ts`. `vi.ts` is canonical (`as const`); `en.ts` is `Record<keyof typeof vi, string>`. Use `useTranslate()` in React; non-React uses pure `translate(locale, key)`. Interpolation is caller-side `String.prototype.replace`.

### playgrounds/admin

- Vite dev proxy: `127.0.0.1:3001` (admin-api loopback). Same `/api/*` strip rewrite as playgrounds/web. Production reverse proxy must mirror **and** gate `/api/*` with network-layer auth.
- `playgrounds/admin/src/api/client.ts` has **no session-id wiring** (admin-api doesn't mount `withSession`).
- TanStack Query keys: `['admin', <feature>, <params?>]`; `<feature>` ∈ `'unanswered' | 'pairs' | 'teach-queue' | 'stats'`. Mutations invalidate by prefix.
- `useImport` uses plain `fetch`, **not** `apiJson` — `File` body must stream raw and content-type discriminates server-side (`application/x-ndjson` vs `application/json`). Same carve-out for any future multipart/form-data hook.
- Free-text search inputs debounced 250ms via `lib/use-debounced.ts`. Enum-pick controls refetch immediately.
- **Runtime `apiBase`** (Phase 16): `playgrounds/admin/src/config/api-base.ts`'s `getApiBase()` is called fresh on every `fetch`, never snapshotted. Active preset persists under `cosimi.config.activePresetId`; presets list under `cosimi.config.presets` as `{ version: 1, presets: ConfigPreset[] }`. Synthetic Default (id `"__default__"`) is NEVER stored — materialized from `import.meta.env.VITE_API_BASE` at boot, so rebuilds update it without a storage wipe. Version mismatches reset to empty. Any new outgoing-fetch site MUST call `getApiBase()`; importing `API_BASE` from `lib/env.ts` for outgoing requests is a regression (that constant only seeds the Default).
- **`bootstrapApiBase()`** runs from `main.tsx` after `bootstrapTheme()`, before render. Self-heals a stale `activeId` and attaches a cross-tab `storage` listener that calls `window.location.reload()` on `cosimi.config.activePresetId` change. Idempotent (module-level `attached` flag). Switching backends is a full reload by design — TanStack Query keys don't include apiBase, so without the reload, backend X's cached rows would render as backend Y's. Don't replace with `queryClient.clear()`. The 500ms toast lead-in is the operator's signal.

### UI primitives & styling

- Tokens shared via `@cosimi/ui-tokens` (Tailwind v4 `@theme`); shadcn primitives are NOT shared — copied per-app under `apps/<name>/src/components/ui/*`. Don't "DRY up" primitives into a workspace package.
- Tailwind v4 is CSS-first. No `tailwind.config.{ts,js}`. Config in `apps/<app>/src/styles/globals.css`: `@import "tailwindcss"` then `@import "@cosimi/ui-tokens/theme.css"`. Vite plugin: `@tailwindcss/vite`.
- **Theme**: `[data-theme="dark"|"light"]` on `<html>` wins unconditionally; `@media (prefers-color-scheme: dark)` matches only when `:root:not([data-theme])`. Key `localStorage.cosimi.theme` — shared between apps. `bootstrapTheme()` runs from `main.tsx` before render. Don't `window.matchMedia` after an explicit choice — read `data-theme` from the DOM.
- Reduced-motion is a token-layer concern. Global `@media (prefers-reduced-motion: reduce)` in `theme.css` clamps `animation-duration` / `transition-duration` / `scroll-behavior` on `*`. No per-component rules.
- Enum-pick UI: native `<select>` with token styling. Multiselect: native checkboxes + `aria-label`. Don't reach for Radix Select/Checkbox unless design needs floating UI / indeterminate state.
- `<ConfirmDialog>` is the workspace destructive-action gate. **Children must be inline-only** (`DialogDescription` renders `<p>`). For block descriptions, promote with a `descriptionAsChild` slot.
- `<Pagination>` is workspace-shared `{ page, hasMore, onChange }`. Caller owns `hasMore` (typically `items.length === PAGE_SIZE`). Wrap with `{(page > 0 || items.length === PAGE_SIZE) && <Pagination ... />}`.
- Feature components live under `features/<name>/components/`; `components/ui/*` is for stateless shadcn-style primitives only.
- `<Toaster />` mounts at the React root (sibling of `<App />` in `main.tsx`), never inside `<App />`. One per app. Position `top-right` + `richColors closeButton`.
- Error display is toast-first. `role="alert"` is reserved for inline errors that gate the next interaction (field-level validation blocking submit).
- Keyboard shortcuts scope to the view's outermost `<section ref tabIndex={-1}>`, never `window.addEventListener('keydown', ...)`. Listener re-checks `document.activeElement.tagName` (`INPUT`/`TEXTAREA`/`SELECT`) and `isContentEditable`. Only exception: the `?` cheatsheet. Shared overlay: `playgrounds/admin/src/components/KeyboardShortcuts.tsx` — append to `SHORTCUTS`.

## Project status

Phases 0–16 merged on `main` (deploy squashed in as `feat(deploy)`). 524 tests across the constellation + playgrounds. Standing gates: `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm -r --workspace-concurrency=1 test`.

**SDK refactor (branch `phase-sdk-sp1`):** SP1 done — `@cosimi/*` constellation extracted (core, normalizer, matcher, db-core, adapter-postgres, logger, sdk), apps moved to `playgrounds/`, `playgrounds/api` consumes `@cosimi/sdk`, Tier 2/3 seams landed (inert subdir), changesets + publish metadata wired. Publish itself is operator-gated. **SP2** (Tier 2/3 impl) and **SP3** (extract `apps/portf` → 8bu.dev repo as a `@cosimi/sdk` consumer) are the next cycles — see `docs/NEW_ARCHITECTURE.md`.

**Deploy:** portf is LIVE — `https://8bu.dev` (Pages) + `portf-api` Worker (`8bu.dev/api/*`) → Hyperdrive → Neon `portf` (459 pairs). cosimi (`playgrounds/web` + `cosimi-api`) wired but undeployed. All-Cloudflare, no VPS/Docker. Manual deploy via `./deploy.sh`; see `docs/DEPLOY.md`. Note: `deploy.sh` now `cd playgrounds/api` (was `apps/api`).

Out of scope: UI-chrome i18n (admin chrome English-only), multi-user accounts, observability dashboards (pino → stdout for v1; OpenTelemetry is the natural next step), telemetry. `<DataTable>` extraction is deferred — needs three call sites + genuine design before code.