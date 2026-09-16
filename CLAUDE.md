# cosimi — Codebase Map for AI Agents

## What this is

cosimi distills a document corpus into retrievable knowledge for RAG. Offline (Node, uses an LLM): documents are chunked, an LLM generates Q&A pairs from each chunk, a second LLM pass audits them, and chunks + pairs are both embedded (bge-m3, 1024-dim, pgvector). At query time (Node or Cloudflare Workers, NO LLM) `retrieve(query)` embeds the query once and returns the top-K nearest pairs and chunks by cosine similarity — deterministic: same query + same data → same result. Consumers feed the hits to their own RAG/LLM step or use the pair answers directly.

## Tech stack

- **Runtime:** Node.js 22, pnpm 11 (pinned via `packageManager`), Turbo 2.
- **Backend:** Hono on Node + Cloudflare Workers. Postgres 16 + `pgvector` (hnsw indexes).
- **Embeddings:** one 1024-dim space — ollama `bge-m3` (dev/offline) / Workers AI `@cf/baai/bge-m3` (prod).
- **Offline LLM:** Anthropic (Sonnet generate/relations, Haiku audit). Never on the query path.
- **Frontend:** Vite + React 19, Base UI + TanStack Router/Query + zustand, Tailwind v4 (CSS-first, no JS config).
- **Tooling:** TypeScript 5.7, oxlint + oxfmt, tsx, valibot, pino, vitest.

## Monorepo layout

```
packages/                  # the published constellation + private tooling
  sdk/            # @cosimi/sdk — facade createCosimi(config); runtime retrieve + ./offline ingest entries
  core/           # @cosimi/core — DTOs, valibot env schema, ports (Embedding/LLM), branding
  retriever/      # @cosimi/retriever — the deterministic retrieval algorithm (two-pool ANN)
  normalizer/     # NFC + lowercase + whitespace (preserves diacritics)
  db-core/        # @cosimi/db-core — repository ports, migrations, migrate CLI, applyMigrations()
  adapter-postgres/        # request-scoped/pooled client + repos + scripts (peerDep: postgres)
  adapter-embed-ollama/    # EmbeddingPort over a local ollama daemon (bge-m3) — dev + offline
  adapter-embed-workers-ai/# EmbeddingPort over a Cloudflare Workers AI binding — prod
  adapter-embed-fake/      # deterministic in-process embedder for tests
  adapter-llm-anthropic/   # LLMPort over Anthropic Messages (offline generate/audit)
  adapter-llm-fake/        # scripted LLMPort for tests
  adapter-storage/         # StorageRepository — local FS (dev)
  logger/         # pino + redactInput()
  tsconfig/ oxlint-config/ template/   # private tooling (never published)
playgrounds/               # reference apps that consume @cosimi/sdk (NOT published)
  api/         # public retrieval REST (:3000); POST /retrieve + /stats + /healthz; Node + Workers entries
  admin-api/   # internal ingest + corpus REST (:3001), binds 127.0.0.1
  lab/         # internal UI (:5173): React 19 + Base UI + TanStack + zustand; Retrieve, Ingest, Documents, Fallback, Corpus
docs/
  ARCHITECTURE.md  # canonical SDK architecture (retrieval algorithm, ingest pipeline, data model) — read first
  superpowers/     # per-sub-project specs + plans (gitignored, local working docs)
```

## SDK constellation

- **Distribution:** `@cosimi/*` packages version in lockstep via changesets (the `fixed` list in `.changeset/config.json`); go-live is operator-gated — `pnpm release` builds `./packages/*`, then `changeset publish`. Driver deps the consumer owns (`postgres`, `@anthropic-ai/sdk`) are **peerDependencies**, never bundled.
- **Facade:** `createCosimi(config)` → `CosimiClient` with `retrieve()` + opt-in `healthcheck()`. `config.sql` is the injected postgres **accessor** (resolves the Workers request-scoped client at call time); `config.embedder` is **mandatory** and must report `dimension === EMBEDDING_DIM` or construction throws — no module-level state, no I/O at construction, Workers-safe.
- **Runtime/offline split:** `@cosimi/sdk` (retrieve, Workers-safe) vs `@cosimi/sdk/offline` (Node-only ingest pipeline); subpath `exports` keep LLM-heavy offline deps out of the Workers bundle.

Full design in **`docs/ARCHITECTURE.md`**.

## Commands

- `pnpm dev` — Docker guard → `db:up --wait` → `migrate` → `turbo run dev --filter='./playgrounds/*'` (api + admin-api + lab).
- `pnpm db:up` / `db:down` / `db:reset` — Postgres dev container (`cosimi-postgres`).
- `pnpm migrate` (up) — applies all numbered migrations incl. the pgvector schema; no flag. For `status`/`reset`: `pnpm --filter @cosimi/db-core migrate <sub>`.
- `pnpm typecheck` / `lint` / `format:check` / `test` / `build` — turbo fan-out.
- DB tests race when parallel: `pnpm -r --workspace-concurrency=1 test`.
- `./deploy.sh` — all-Cloudflare manual deploy. Menu: gates · lab → Pages project `cosimi-web` · `cosimi-api` Worker · both · migrate the Neon DB (prompts for the DIRECT connection URL) · tail · status.

## Conventions

### Workspace & supply chain

- Workspace packages `@cosimi/<name>`; import via `@cosimi/...`, never relative across packages. `link-workspace-packages=true` makes self-imports work.
- `@cosimi/adapter-postgres` resolves its internals through package `imports`: `#client`, `#repositories/*`, `#scripts/*`. Outside the package always import `@cosimi/adapter-postgres`.
- `pnpm-workspace.yaml`: `minimumReleaseAge: 10080` (7-day embargo); force-include a version via `minimumReleaseAgeExclude` only with a `# why` comment.
- `allowBuilds` is the postinstall allowlist — each entry runs install-time code; add deliberately with a `# why` comment. No wildcards.

### Architecture & security

- `playgrounds/api` and `playgrounds/admin-api` are **separate processes**. admin-api binds `127.0.0.1`; the process split + network-layer gate IS the auth contract — don't add app-layer auth to admin routes. The whole admin process is the admin surface: no `/admin/*` route prefix.
- **No LLM at runtime** in `playgrounds/api`. Vector retrieval over pairs and chunks is the only reply source; any LLM/RAG synthesis is the downstream consumer's job.
- **The Anthropic key is client-managed.** Offline ingest needs an LLM key: entered in the lab (localStorage), sent per request via `X-Anthropic-Key`, and **never** read from env, persisted (including the `ingest_jobs` row), or logged. Any new ingest/job path keeps it in memory only.
- Env via `loadEnv()` from `@cosimi/core` — called at startup or first use, never at import time. Never `export const env = loadEnv()` (breaks test env injection). On Workers, deploy-time startup validation runs global scope with NO bindings, so an import-time `loadEnv()` fails: hence `playgrounds/api/src/lib/logger.ts` is a lazy `Proxy`, and `worker.ts` hoists `HYPERDRIVE.connectionString` into `process.env.DATABASE_URL` before the routes run.
- **Workers deploy** (`playgrounds/api`): `src/worker.ts` is the Worker entry, `src/index.ts` the Node entry; `wrangler.toml` has one env, `[env.cosimi]`. Hyperdrive must point at the Neon **direct** endpoint so postgres.js prepared statements work. pino logs are invisible to `wrangler tail` — only `console.*` surfaces.

### Database & migrations

- `sql()` from `@cosimi/adapter-postgres` returns a request-scoped client on Workers, else a process-level singleton pool (Node dev/prod/tests). Never create a module-level connection; any new Workers entrypoint touching the DB MUST run inside `runWithRequestDb(fn)` (an `AsyncLocalStorage` per-request client — workerd binds each socket to the request that opened it). Don't `end()` it.
- Migrations in `packages/db-core/migrations/` are numbered, additive, **never rewritten after merge**; new changes → new file. The pgvector schema (`012_graph_schema.sql`, `013_ingest_jobs.sql`) ships in the **default sequence** — every target needs the `vector` extension. `migrate reset` is dev-only (`NODE_ENV !== 'production'`).
- **Canonical write path for `pairs`**: `insertPair` / `insertManyPairs` from `@cosimi/adapter-postgres`. Never raw `INSERT INTO pairs`. Both omit `normalized_unaccented` (Postgres rejects explicit values) and accept an optional `tx`; inside `.begin()` MUST pass `tx`.
- `pairs.normalized_unaccented` is `GENERATED ALWAYS AS (f_unaccent(normalized_input)) STORED`.
- **BIGSERIAL ids round-trip as strings via postgres.js** — cast at the write boundary: `RETURNING id::int AS id`. Chunk/document/job ids are uuids.

> Migration numbering jumps 004 → 009 (005–008 were removed); never renumber or fill the gap. 004 (`import_batches` + `pairs.batch_id`) stays — `batch_id` is part of the pair write path.

### Retrieval (`@cosimi/retriever`)

- **Pairs and chunks are equal embedded targets.** `retrieve(sql, opts)` runs two ANN sub-selects (top-`seedK` pairs filtered `audit_status='pass'` / `deleted_at IS NULL` / locale; top-`seedK` chunks), floors by `minSimilarity`, `UNION ALL`, ranks `(similarity DESC, kind ASC, id ASC)`, takes `topK`. Returns `{ hits: (PairHit | ChunkHit)[] }`.
- A **pair-hit** carries its source chunk plus linked chunks within `maxHops` (root-carrying recursive CTE with a `CYCLE` guard) as `context`; a **chunk-hit** carries its linked pairs. **Chunk links never affect ranking** — ranking is cosine only (`1 - (embedding <=> q)`); no random pick, no jitter.
- Knobs default from env (`RETRIEVE_TOP_K` / `RETRIEVE_SEED_K` / `RETRIEVE_MAX_HOPS` / `RETRIEVE_MIN_SIMILARITY` = 0.45), overridable per call. The caller embeds the raw query ONCE; the retriever is adapter-agnostic (takes the accessor).

### Offline ingest (`@cosimi/sdk/offline`)

- `createIngestService(deps, options).ingest(input)` — pure orchestrator, all I/O injected. Stages: store → chunk+embed → relations → generate → audit → optional reverse-check; emits `onProgress` (injected via deps) throughout. Sonnet does generate/relations, Haiku the audit/reverse.
- **Chunking dispatches on heading presence:** markdown with `##`/`###` → structural `chunkMarkdown` (one chunk per heading; an over-threshold section becomes a `PARENT_OF` parent + sentence children; **no text overlap** — continuity is the links; empty container headings emit no chunk). Everything else (plain text, HTML, headingless markdown) → semantic `chunkByEmbedding`.
- Relations and pair generation run over **leaf chunks only** — a structural parent is not a pair source.
- **Pair-gen gates fact-poor chunks:** skip below `minGenTokens` (default 12) before the LLM call; the prompt may also return `[]`. Each pair links to its source chunk (`chunk_pair_map`) and is embedded.
- **Async by default (admin-api):** `POST /ingest` → `202 { jobId }`; the pipeline runs **detached in-process** and mirrors progress to the durable `ingest_jobs` row; the lab polls `GET /ingest/jobs/:id`. In-process is deliberate — the Anthropic key lives only in the job's memory closure, so a durable cross-process queue (which would persist the key) is the wrong fit. Boot sweeps any `running` job → `error`.

### playgrounds/api

- Three routes: **`POST /retrieve`** (`routes/retrieve.ts`) — dogfoods `createCosimi(...).retrieve()`, returns `{ hits }`; an empty result upserts an `unanswered` row (source `retrieve`) — plus `/stats` (corpus counts) and `/healthz`.
- `/healthz` delegates to the SDK `healthcheck()`: `{ ok, db: 'up'|'down', schema: 'ready'|'absent', issues }`, 200 or 503; it never throws on a not-ready DB.
- `resolveEmbedder()` (`src/lib/embedder.ts`) picks the runtime embedder from `EMBEDDER` (`ollama` | `workers-ai`) and asserts its dimension equals `EMBEDDING_DIM`. The Workers AI binding is request-scoped and carried by `runWithAi` (AsyncLocalStorage) — a missing binding throws instead of silently mis-embedding. admin-api ingest always uses ollama (Node-only).

### playgrounds/admin-api

- Loopback-only. Routes: `/ingest` (+ `GET /ingest/jobs`, `GET /ingest/jobs/:id`), `/documents` (+ `DELETE /:id` purges the document's chunks and generated pairs in one transaction), `/pairs`, `/unanswered`, `/stats`, corpus reads (`/documents/:id/chunks`, `/chunks/:id/pairs`). Its `/healthz` is the plain DB-ping shape `{ ok, db, db_latency_ms, uptime_s }` on a 1s budget, timer `.unref()`'d and cleared in `finally`.
- `POST /pairs` inserts the pair and deletes matching `unanswered` rows in ONE transaction (`db.begin`, `tx` forwarded to `insertPair`) — any new write site must include that cleanup.
- `ingest_jobs` helpers live in `src/lib/ingest-jobs.ts` (raw `sql()`); the route injects `onProgress` into the SDK deps and never writes the key to the row.

### playgrounds/lab

- Single Vite + React 19 app (`@cosimi/lab`, :5173) — the internal console. Feature-organized: `src/features/<name>/{components,hooks,store}` for `retrieve | ingest | documents | fallback | corpus`; file-based TanStack Router (`src/routes/*`, generated `routeTree.gen.ts`); TanStack Query; zustand; Base UI primitives in `src/components/ui/*`; shared atoms in `src/components/shell/*`.
- **Two backends:** `src/config/bases.ts` — `API_BASE = "/api"` (:3000 retrieve), `ADMIN_BASE = "/admin"` (:3001 admin) — rewritten by the Vite dev proxy (`vite.config.ts`). Fetch layers: `src/lib/api/retrieve-client.ts`, `src/lib/api/admin-client.ts`; `src/lib/adapters/*` map raw responses to view models.
- **Anthropic key** lives in `src/config/anthropic-key.ts` (localStorage `cosimi.config.anthropicKey`), attached as `X-Anthropic-Key` on ingest only. Never logged, never sent elsewhere.
- **Ingest is async:** the form starts a job, `useIngestJob` polls every 1.5s while `running`, and `JobProgress` renders it; on `done`/`error` the route toasts and invalidates `["documents"]`. Destructive removal gates through `RemoveDialog` (Base UI AlertDialog). Errors are toast-first (`sonner`); `<Toaster />` mounts in `src/routes/__root.tsx`.

### Locale

- `pairs.locale` defaults to `'und'`. Retrieval filters `(locale = ANY(locales) OR locale = 'und')`; the lab sends its locales (`src/config/locale.ts`). The canonical write path forwards locale — any new write site must thread it through.

### Logging

- PII redaction is belt-and-suspenders. `@cosimi/logger.createLogger()` ships a `redact.paths` list; `redactInput(text)` → `{ length, hash: sha256[..8] }`. INFO+: use `redactInput()` if logging text; DEBUG raw values go under `*_dbg` suffixes. App loggers are thin `createLogger('<app>')` re-exports — never construct pino directly.
- Exception: `playgrounds/api/src/lib/logger.ts` is the lazy `Proxy` that defers `createLogger()` (hence `loadEnv()`) to first use, so the Workers bundle survives import-time deploy validation.

### Tests

- `cosimi_test` is the shared DB (api, admin-api, sdk, retriever, adapter-postgres). Each has a vitest `globalSetup` that DROPs `public` and calls `applyMigrations(db)` — one call, the full sequence.
- DB-touching vitest config: `pool: 'threads'`, `singleThread: true`, `fileParallelism: false`. Run `pnpm -r --workspace-concurrency=1 test` — otherwise they race. `lab` is DB-free (jsdom), safe.
- Fixtures go through `insertManyPairs`, never raw INSERT; API tests drive the in-process Hono app via `app.fetch` (`test/helpers.ts`: `postJson`/`getJson`).
- Lab component tests: jsdom + `@testing-library/react` + `userEvent.setup()`; per-test `cleanup()` in `afterEach` is mandatory. Mock via `vi.hoisted` + `vi.mock`, then `await import(...)` AFTER the mock. `userEvent` deadlocks under fake timers — use `fireEvent` there.

### UI primitives & styling

- Tailwind v4 is CSS-first (no `tailwind.config.{ts,js}`): `src/index.css` holds `@import "tailwindcss"`, the design tokens, and an `@theme inline` bridge mapping tokens to utility colors. Vite plugin `@tailwindcss/vite`.
- **Theme:** the lab root carries `data-theme` (token preset), `data-density`, and `data-rail` (`src/routes/__root.tsx`); the preset/density selectors and their variables live in `src/index.css`.
- Enum-pick UI: native `<select>` with token styling (`Select` in `components/shell/atoms.tsx`).
- `src/lib/icon.tsx` is a bespoke inline SVG set (1.6px stroke, 24×24, `currentColor`) — don't swap it for an icon font.

## Gates

`pnpm -r typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm -r --workspace-concurrency=1 test`
