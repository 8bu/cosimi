# simlm — Codebase Map for AI Agents

## What this is

A SimSimi-style pattern-matching chatbot. **No LLM at runtime** — replies come from a curated/learned pattern store, scored by a 3-tier matching engine (exact → Postgres FTS → trigram). pnpm + Turbo monorepo; public chat API, internal admin API, and two Vite/React UIs share typed packages.

## Tech stack

- **Runtime:** Node.js 22, pnpm 11 (pinned via `packageManager`), Turbo 2.
- **Backend:** Hono.js on Node, Postgres 16 (FTS + `pg_trgm`).
- **Frontend:** Vite + React, Tailwind v4 (CSS-first config — no JS config file).
- **Tooling:** TypeScript 5.7, oxlint + oxfmt, tsx, valibot, pino, vitest.

## Monorepo layout

```
apps/
  api/         # public Hono REST + SSE, binds PORT on 0.0.0.0
  admin-api/   # internal Hono REST, binds ADMIN_PORT on 127.0.0.1
  web/         # public chat UI (Vite + React + Tailwind v4)
  admin/       # internal admin dashboard (Vite + React)
packages/
  config/         # valibot env schema
  types/          # shared DTOs (server + clients import the same `T`)
  normalizer/     # pure NFC + lowercase + whitespace (preserves diacritics)
  db/             # postgres client, migrations, repositories
  matcher/        # 3-tier matching engine
  logger/         # pino + redactInput() — shared by api + admin-api
  ui-tokens/      # Tailwind v4 @theme tokens (shared CSS — primitives are NOT)
  tsconfig/       # shared tsconfig bases
  oxlint-config/  # shared oxlint ruleset
seeds/
  vi/             # hand-curated Vietnamese seeds
  chatterbot/     # frozen chatterbot-corpus snapshot (SHA-pinned)
docs/             # phased specs SPEC_PHASE_0.md … SPEC_PHASE_15.md
```

## Specs

Phased plan in `docs/SPEC_PHASE_*.md`; product brief in `docs/REQUIREMENTS.md`. **Read only the current phase's spec unless cross-phase context is needed** — resist reading ahead.

## Commands

- `pnpm dev:all` — default start: Docker guard → `db:up --wait` → `migrate` → `dev`. Errors clearly if Docker daemon is down.
- `pnpm dev` — turbo dev across all apps. Assumes Postgres is up + migrated.
- `pnpm db:up` / `db:down` / `db:reset` — Postgres dev container (`db:up` uses `--wait`, safe to chain `migrate`).
- `pnpm migrate` / `seed` / `seed:chatterbot` — db management. Root `migrate` runs `up`; for `status`/`reset` use `pnpm --filter @simlm/db migrate <sub>`.
- `pnpm typecheck` / `lint` / `test` / `build` — turbo fan-out.
- DB tests race when parallel: use `pnpm -r --workspace-concurrency=1 test`.

## Conventions

### Workspace & supply chain

- Workspace packages are `@simlm/<name>`, `private: true`. Cross-package imports go through `@simlm/...` (pnpm wires via `link-workspace-packages=true`); never relative paths across packages.
- `@simlm/db` internal subpath imports use `#client`, `#repositories/*`, `#scripts/*`. Outside the package, always `@simlm/db` — never `#`.
- `pnpm-workspace.yaml` has `minimumReleaseAge: 10080` (7-day embargo on new releases). Force-include via `minimumReleaseAgeExclude` only as a deliberate, reviewed entry. CI's `--frozen-lockfile` is unaffected.
- `allowBuilds` in `pnpm-workspace.yaml` is the postinstall permission list. Each entry = arbitrary install-time code; add deliberately, comment *why*. Current: `esbuild` (tsx native binary), `@swc/core` (Vite React transform). No wildcards.

### Architecture & security

- `apps/api` and `apps/admin-api` are **separate processes**. admin-api binds `127.0.0.1`; non-loopback `ADMIN_HOST` is a soft warn, not a refusal. The process split + network-layer gate IS the auth contract — don't add app-layer auth to admin routes (would imply they're safe to expose externally, which is false). No `/admin/*` route prefix.
- **No LLM at runtime** in `apps/api`. The `@simlm/matcher` engine is the only reply source.
- Env via `loadEnv()` from `@simlm/config` — called once at app startup, never at import time. Never `export const env = loadEnv()` (re-couples imports to environment, breaks test env injection).

### Database & migrations

- Migrations in `packages/db/migrations/` are numbered, additive, and **never rewritten after merge**. New changes → new file. `_migrations` tracks applied. `pnpm migrate reset` is dev-only (`NODE_ENV !== 'production'` guard).
- **Canonical write path for `pairs`**: `insertPair` / `insertManyPairs` from `@simlm/db`. Never raw `INSERT INTO pairs`. They enumerate columns and deliberately **omit `normalized_unaccented`** — Postgres rejects explicit values for it. They also accept an optional `tx` (postgres.js `Sql | TransactionSql`); inside a `.begin()` block you MUST pass `tx` or you silently lose atomicity.
- `pairs.normalized_unaccented` is `GENERATED ALWAYS AS (f_unaccent(normalized_input)) STORED`. STORED (not virtual) so all three matching indexes can sit on it. Never INSERT/UPDATE it directly.
- **Diacritics split**: `@simlm/normalizer` does NFC + lowercase + whitespace and **preserves diacritics**. `f_unaccent(text)` (IMMUTABLE wrapper around `unaccent`, migration 001) is the server-side stripper. All pair tiers compare `pairs.normalized_unaccented` against `f_unaccent(${normalizedInput})`. Never strip diacritics in JS — would diverge from server. `session_teaches` has no generated column (10-min TTL keeps it tiny) — both sides `f_unaccent` at query time; add a functional index if it grows.
- **BIGSERIAL ids round-trip as strings via postgres.js by default.** Cast at the write boundary: `RETURNING id::int AS id`. Used in `insertPair`, `createBatch`, teach-queue approve, `POST /pairs`, and test seedPairs helpers.
- Interval arithmetic in templated SQL: `${n} * INTERVAL '1 unit'`. Never `(n || ' unit')::interval` (postgres.js types JS numbers as int; `int || text` raises).
- `app_config` is a key/value table; templated responses use `{{ key }}` placeholders. `renderTemplate(text, vars)` is case-insensitive, identifier-only keys, unknown keys left literal. Tests deliberately exclude `app_config` from TRUNCATE so migration-seeded rows (`name`, `fallback_message_*`) survive resets. Adding a placeholder = new migration with `INSERT … ON CONFLICT DO NOTHING`, never a schema change.

### Seeds & batches

- Every seed run creates exactly one `import_batches` row (`createBatch` → `insertManyPairs(..., batch_id)` → `setBatchCount`). The batch IS the unit of rollback. Re-seeding creates duplicates *by design* — traceable via per-batch note.
- Seed CLI dispatches by extension: `.json` (array), `.jsonl` (one-per-line), `.yaml`/`.yml` (flat list; chatterbot-corpus when top-level `conversations:` or `categories:` — flattened with sliding window). Globs expand shell-side.
- Root scripts (`pnpm seed:vi` etc.) run `tsx packages/db/src/scripts/seed.ts <glob>` from the workspace root, not `pnpm --filter` — `--filter exec` would `cd` into the package and break repo-root globs. `#client` subpath imports still resolve correctly.
- `seeds/chatterbot/` is a frozen upstream snapshot SHA-pinned in `seeds/chatterbot/NOTICE`. Listed in `.oxfmtignore`. No postinstall network fetch — refresh manually.

### Matcher

- Cascade: `session_teach → exact → FTS → trigram`, short-circuit on first non-null. `match()` exports the cascade plus the four tier functions individually. Caller normalizes input (matcher doesn't call `@simlm/normalizer`). Skip `session_teach` when `sessionId` is null.
- All match queries filter `(locale = $1 OR locale = 'und') ORDER BY (locale = $1) DESC`. OR = inclusion (locale-tagged + universal both eligible); ORDER BY = locale-tagged wins ties. Don't remove either half — without the OR, universal seeds go dark for non-'und' primary; without the ORDER BY, a vi user could get an 'und' answer when a vi one exists.
- Trigram tier double-filters: `%` index op **AND** explicit `similarity(...) >= MATCH_TRGM_MIN`. The explicit threshold pins behavior to our env (the `%` GUC is process-global and mutable). Never replace with `set_limit()`.
- `lowConfidence` ⇔ `tier === 'trigram'`. FTS `ts_rank` clamped to `[0, 1]` for UI uniformity. Top-K random pick (`MATCH_TOP_K`, default 5) happens **in JS** after SQL ordering — don't push into SQL (loses `score DESC` tiebreaking observability).

### apps/api: chat + SSE + teach

- `withSession` middleware reads `c.req.json()` exactly once and stashes the body at `c.set('parsedBody', body)`. Route handlers MUST read `c.get('parsedBody')` — Hono body stream is single-use. Session id resolves body → `X-Session-Id` header → minted, then echoes in response header on every request.
- SSE: every response ends with the literal frame `data: [DONE]\n\n`, written from `finally` so it fires even on error. `ChatStreamEvent.type === 'done'` is for client `switch` exhaustiveness only — the wire-level terminator is always the `[DONE]` literal.
- SSE error visibility: `TeachError.message` is user-facing; everything else surfaces as generic "teach failed" / "internal error" with the diagnostic logged. `services/rate-limit.ts` throws a plain `Error` to dodge a circular import with teach-handler; teach handler rewraps as `TeachError` so the rate-limit message still reaches the client.
- GC lives in-process: single `setInterval` (period `GC_INTERVAL_MS`, default 5min) DELETing expired rows from `sessions` + `session_teaches` in parallel. Interval handle is `.unref()`'d so it doesn't block shutdown. SIGINT/SIGTERM → `stopGc()` then `server.close()`. Zero-row sweeps stay silent. Multi-instance would need a Postgres advisory lock; out of scope for v1.
- `/healthz` runs a 1s-budgeted DB ping; the timeout is `.unref()`'d AND cleared in `finally`. Two identical route files (api + admin-api) — touch both, or extract to a shared helper when a third health check appears. Response shape: `{ ok, db: 'up'|'down', db_latency_ms, uptime_s }`.

### apps/admin-api

- Teach-queue approval uses `insertPair({...}, tx)` inside a transaction so queue UPDATE + pair INSERT are atomic. The `insertPair(_, tx)` overload exists for this; outside transactions, omit the second arg.
- `/import` JSONL streaming reads `c.req.raw.body!.getReader()` directly to bypass Hono's buffered parser (OOM-safe at 10k rows). `FLUSH_AT=500` bounds in-memory batch; each flush goes through `insertManyPairs`. Each `/import` call creates exactly one `import_batches` row.
- `/import` accumulates a `Set<string>` of normalized inputs across all flushes (JSONL **and** buffered-JSON paths), then runs one `DELETE FROM unanswered WHERE normalized_input = ANY(...)` after the last flush. Per-import scope, NOT pushed into `insertManyPairs` — the seed CLI uses `insertManyPairs` and shouldn't trigger cleanup. The DELETE is outside the per-batch transaction (one DELETE per request, not per 500 rows).
- `POST /pairs` atomically deletes matching `unanswered` rows in the same transaction. Match key: `unanswered.normalized_input = normalize(input)`, **no source filter** (a 'chat' and 'llm' duplicate share one canonical answer). Any new write site must include this cleanup or duplicate the gap.
- `/rollback` is `UPDATE pairs SET deleted_at = NOW() WHERE deleted_at IS NULL AND <filters>` — re-runs are no-ops by design. Soft-delete only; don't add a hard-delete path. Partial indexes on `deleted_at IS NULL` keep active reads zero-cost.
- `/pairs` PATCH builds SET clauses as conditional sql fragments, NOT `sql(obj, ...cols)`. The object helper turns `sql\`NOW()\`` fragments into text literals; the chain-of-fragments approach keeps `updated_at = NOW()` as real SQL while parameterizing user fields.
- `/pairs?batch_id=N` is **navigation-target-only** — no manual input in `<PairsFilters>`. Populated by Import success card → "View rows" link via `useSearchParams()`. Clear via URL param mutation.

### Locale

- Default `'und'` (BCP-47 "undetermined") everywhere: `pairs`, `session_teaches`, `teach_queue` all `TEXT NOT NULL DEFAULT 'und'` (migration 010). Changing the default would silently split the existing corpus along language lines — don't, without a backfill migration.
- Canonical write path forwards locale: `insertPair` / `insertManyPairs` enumerate it; `teach-handler` stamps it on both `teach_queue` AND `session_teaches` in one transaction; admin-api teach-queue approval reads queue locale and forwards to `insertPair`. Any new write site must thread it through.
- `app_config[fallback_message_<locale>]` is the no-match line. Lookup priority in `chat-handler.ts`: `fallback_message_${locales[0]}` → `fallback_message_und` → `env.FALLBACK_MESSAGE`. All pass through `renderTemplate`. Adding a locale fallback = new migration INSERT, never edit 010 in place.
- `useEditPair` does NOT thread `locale` — `AdminPair` has no field and the PATCH schema rejects it. Locale stamping happens at insert time only; phase locale-edit UX separately if asked.

### Logging

- PII redaction is belt-and-suspenders. `@simlm/logger.createLogger()` ships a `redact.paths` list (`input`, `response`, `reply`, `message`, `body.message`, `body.reply`, `body.input`); `redactInput(text)` converts to `{ length, hash: sha256[..8] }`. INFO+: use `redactInput()` if logging text. DEBUG: raw values go under `*_dbg` field-name suffixes so the redact list won't strip them.
- App logger files are thin `createLogger('<app>')` re-exports — **never** construct a pino instance directly or you skip the redact contract.

### Tests

- `simlm_test` is a separate Postgres database shared by `packages/matcher`, `apps/api`, `apps/admin-api`. Each has its own `vitest globalSetup` that drops `public` and applies every migration. The migration loop is inlined in three places — a fourth DB-touching suite is the threshold to extract `applyMigrations()` from `migrate.ts`; don't add a fourth inlined copy.
- DB-touching vitest config: `pool: 'threads'`, `singleThread: true`, `fileParallelism: false`. Run package suites with `pnpm -r --workspace-concurrency=1 test` — otherwise they race on the shared DB. `apps/web` + `apps/admin` are DB-free (jsdom) and can run in parallel.
- `MATCH_FTS_MIN` is `0.01` in matcher tests vs production `0.1` — short fixture queries produce sub-0.1 `ts_rank`. If a test asserts a high-confidence FTS match, raise the threshold locally.
- Test fixtures go through `insertManyPairs`, never raw INSERT (canonical-write-path rule). Soft-deletion in tests is `UPDATE … SET deleted_at = NOW()` after the insert (need id first). `session_teaches` test inserts still use raw SQL — no repo helper exists yet.
- `apps/api/test/global-setup.ts` pins `SSE_DELAY_BASE_MS=0` and `SSE_DELAY_JITTER_MS=0` so token pacing doesn't blow per-file timeouts.
- **SSE responses must be drained** in tests before dependent follow-ups (or risk half-applied transactions and TRUNCATE-on-`sessions` deadlocks). Use `drain(res)` or `consumeChatStream(res)` from `apps/api/test/helpers.ts` — even for header-only assertions.
- Web + admin component tests: jsdom + `@testing-library/react` + `userEvent.setup()`. Per-test `cleanup()` in `afterEach` is mandatory (vitest 3 doesn't auto-unmount). Mock `@/api/client.apiJson` via `vi.hoisted` + `vi.mock`, then `await import('@/...')` AFTER the mock.

### Shared types

- Public-API DTOs live in `@simlm/types`. `apps/api` route handlers declare `const payload: <T> = …; return c.json(payload)`; clients re-import the same `T` via `apiJson<T>`. Don't re-declare response shapes client-side.
- LLM bulk-import doc: `docs/LLM_IMPORT_FORMAT.md`. URLs reflect actual `http://127.0.0.1:3001/<route>` shape (no `/admin/*` prefix). If you reshape admin routes, update the doc in lockstep. The 200-char input/response cap in the doc is advisory; server's valibot cap is 2000.

### apps/web

- Feature-organized: `src/features/<name>/{types,store,tokens,components}`. `routes/` files are thin composition shells. `features/chat/` sets the template.
- `apiFetch`'s `raw: true` is load-bearing for streaming endpoints: keeps the body un-consumed for `parseSseStream` and lets the caller decide error handling. JSON endpoints go through `apiJson` (default error mapping).
- SSE consumer is hand-rolled in `lib/sse-parser.ts`: async generator over `ReadableStream<Uint8Array>` (EventSource is GET-only; we POST a body). Frames split on `\n\n`; trailing buffer stays for next chunk; `finally` releases the reader lock for clean abort. `[DONE]` is the stream-end sentinel.
- `API_BASE = import.meta.env.VITE_API_BASE ?? '/api'`. Default `/api` pairs with the Vite proxy strip (`/api/foo` → `:3000/foo`). Override only when SPA is served from a different origin than `apps/api`.
- **Session id is server-canonical.** Client adopts whatever comes back in `X-Session-Id`. Persisted under `localStorage.simlm.session` via zustand `persist`. **Never `crypto.randomUUID()` for session ids** — duplicating UUID generation invites split-brain. Local UI ids (React keys) are fine to mint client-side.
- Locale read imperatively at request time: `streamChat()` calls `preferencesStore.getState().primaryLocale` per turn and stuffs `locales: [primary, 'und']` into the body. Mirror this pattern for any future per-request server-bound preference (no React reactivity needed in non-React code paths).
- **Teach detection regex is duplicated server + client; server's `looksLikeTeach` is canonical.** Server: `PREFIX_RE = /^\/teach\b\s*/i` (`apps/api/src/services/teach-parser.ts`). Client: `TEACH_PREFIX_RE = /^\/teach\b/i` (`apps/web/src/features/chat/tokens.ts`). Change one → change the other in the same commit; silent divergence = invisible UX/server mismatch.
- UI message types ≠ API event types. The zustand reducer in `features/chat/store.ts` bridges SSE events → `ChatMessage` (settled-state union). Components consume `ChatMessage` only — never render SSE events directly.
- UI chrome strings in `src/lib/i18n/<locale>.ts`. `vi.ts` is canonical (`as const`); `en.ts` is typed `Record<keyof typeof vi, string>`. Use `useTranslate()` in React; non-React (chat store) uses pure `translate(locale, key)` + `preferencesStore.getState()`. Interpolation is caller-side `String.prototype.replace`.

### apps/admin

- Vite dev proxy: `127.0.0.1:3001` (not `localhost:3000`) — points at admin-api's loopback bind. Same `/api/*` strip rewrite as apps/web. Production reverse proxy must mirror **and** gate `/api/*` with network-layer auth.
- `apps/admin/src/api/client.ts` has **no session-id wiring** (admin-api doesn't mount `withSession`). Adding one would imply per-user admin auth that doesn't exist server-side.
- TanStack Query keys: `['admin', <feature>, <params?>]`. `<feature>` ∈ `'unanswered'`, `'pairs'`, `'teach-queue'`, `'stats'`. Mutations invalidate by prefix (`['admin', 'unanswered']` nukes all variants). Extend the params object freely — TanStack does deep equality.
- `useImport` uses plain `fetch`, **not** `apiJson`. Carve-out: `File` body must stream raw, and content-type discriminates server-side (`application/x-ndjson` vs `application/json`). Same carve-out applies to any future multipart/form-data hook.
- Search inputs debounced 250ms via `lib/use-debounced.ts`. Enum-pick controls (`<select>`, checkboxes) refetch immediately — debounce only free-text fields.
- **Runtime `apiBase` resolution: `apps/admin/src/config/api-base.ts`'s `getApiBase()` is called fresh on every `fetch`, never snapshotted.** Build-time `VITE_API_BASE` only seeds the synthetic "Default" preset that's materialized by the store — operators pick the active preset from `<PresetSwitcher>` in the sidebar; selection persists under `simlm.config.activePresetId`. No caching layer between localStorage and `fetch` — one localStorage read per request is sub-µs and avoids stale-tab-with-changed-preset bugs entirely. If you add a new request site outside `apiJson` (multipart, raw `fetch`, etc.), it MUST call `getApiBase()`. Importing `API_BASE` from `lib/env.ts` directly for outgoing requests is a regression — that constant exists only to seed the Default preset.
- **`bootstrapApiBase()` boot helper: called from `main.tsx` directly after `bootstrapTheme()`, before render.** It self-heals stale `activeId` values (e.g. preset was deleted in another tab) and attaches the cross-tab `storage` listener that calls `window.location.reload()` when `simlm.config.activePresetId` changes elsewhere. The helper is idempotent against StrictMode double-invoke via a module-level `attached` flag. Switching backends is a full-page reload by design — TanStack Query keys do not include the apiBase, so cached `/pairs` rows from backend X would silently render as backend Y's pairs without the reload. Don't replace the reload with `queryClient.clear()` — too many in-flight + captured-at-import-time edge cases. The 500ms toast lead-in before the reload is the operator's signal that the page is reloading on purpose.
- **`simlm.config.*` localStorage keys: `presets` (versioned array) + `activePresetId` (string).** Same `simlm.*` namespacing as `simlm.theme`, `simlm.session`, `simlm.preferences`. The persisted-presets value is `{ version: 1, presets: ConfigPreset[] }` — version mismatches reset to empty rather than fail, so a future schema bump can ship a migration without locking out operators. The synthetic Default preset is NEVER written to storage; it's materialized from `import.meta.env.VITE_API_BASE` at boot, which means re-bundling the SPA with a new build env immediately updates the Default without a storage wipe. The active id `"__default__"` is the sentinel for "use the synthetic Default."

### UI primitives & styling

- Tokens shared via `@simlm/ui-tokens` (Tailwind v4 `@theme` block); shadcn primitives are NOT shared — copied per-app under `apps/<name>/src/components/ui/*`. Token edits propagate (visual identity); primitive customization stays local. Don't "DRY up" primitives into a workspace package.
- Tailwind v4 is CSS-first. No `tailwind.config.{ts,js}`. Config lives in `apps/<app>/src/styles/globals.css` via `@import "tailwindcss"` then `@import "@simlm/ui-tokens/theme.css"`. Vite plugin: `@tailwindcss/vite`. Adding a JS config is a regression.
- **Theme override**: `[data-theme="dark"|"light"]` on `<html>` wins unconditionally; `@media (prefers-color-scheme: dark)` matches only when `:root:not([data-theme])`. Persistence key `localStorage.simlm.theme` — **shared between apps**. `bootstrapTheme()` runs from `main.tsx` before render. Don't `window.matchMedia` from JS after an explicit choice — read `data-theme` from the DOM.
- Reduced-motion is a token-layer concern. Global `@media (prefers-reduced-motion: reduce)` rule in `theme.css` clamps `animation-duration` / `transition-duration` / `scroll-behavior` on `*`. Don't add per-component `@media (prefers-reduced-motion)` rules.
- Enum-pick UI: native `<select>` with token styling. Multiselect: native `<input type="checkbox">` + `aria-label`. Don't reach for Radix Select/Checkbox unless design genuinely needs floating UI / indeterminate state — re-earn the dep each time.
- `<ConfirmDialog>` is the workspace-shared destructive-action gate. **Children must be inline-only** (`DialogDescription` renders `<p>` — block children = invalid HTML + hydration warnings). For block descriptions, promote with a `descriptionAsChild` slot.
- `<Pagination>` is the workspace-shared `{ page, hasMore, onChange }` prev/next. Caller owns `hasMore` (typically `items.length === PAGE_SIZE`). Wrap with `{(page > 0 || items.length === PAGE_SIZE) && <Pagination ... />}` to hide on single sub-PAGE_SIZE pages.
- Feature components live under `features/<name>/components/`; `components/ui/*` is reserved for stateless shadcn-style primitives. Domain logic in `ui/*` = move it out.
- `<Toaster />` mounts at the React root (sibling of `<App />` inside `<BrowserRouter>` in `main.tsx`), **never** inside `<App />`. One per app. Position `top-right` + `richColors closeButton`.
- Error display is toast-first. `role="alert"` is reserved for inline errors that gate the next interaction (field-level validation blocking submit). Chat-store `error` SSE event also toasts.
- Keyboard shortcuts: scoped to the view's outermost `<section ref tabIndex={-1}>`, **never** `window.addEventListener('keydown', ...)`. Listener re-checks `document.activeElement.tagName` (`INPUT`/`TEXTAREA`/`SELECT`) and `isContentEditable` before firing. Only exception: the `?` cheatsheet (still suppresses inside inputs). Workspace-shared overlay: `apps/admin/src/components/KeyboardShortcuts.tsx` — append to its `SHORTCUTS` array.

## Project status

**In flight — Phase 16 (admin runtime backend presets, `apps/admin` only).** Phases 0–15 are merged on `main` (test count: 211 across 8 suites). Phase 16 adds a sidebar `<PresetSwitcher>` and a `/presets` CRUD view that lets operators store named backend URLs in localStorage and switch the active one (page-reload semantics) — see `docs/SPEC_PHASE_16.md`.

Standing gates remain: `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm -r --workspace-concurrency=1 test`.

Out of scope: UI-chrome i18n (admin chrome English-only), multi-user accounts, observability dashboards (pino → stdout for v1; OpenTelemetry is the natural next step), telemetry. `<DataTable>` extraction is deferred — needs three call sites + genuine design before code.
