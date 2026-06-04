# cosimi — Codebase Map for AI Agents

## What this is

A deterministic, **LLM-free-at-query-time**, GraphRAG-*inspired* retrieval SDK. Ingest documents
offline (an LLM turns source text into a chunk graph + Q&A pairs); at runtime `retrieve(query)`
returns a ranked, deterministic structure over vector-NN seeds + a bounded graph walk — same
query + same data → same result. The consumer owns any downstream RAG/LLM step, or uses the
pre-generated pairs directly as answers. pnpm + Turbo monorepo; a published `@cosimi/*` SDK
constellation + reference playground apps.

> **GraphRAG-*inspired*, not Microsoft GraphRAG.** No entity extraction, communities, or
> global/local search — the chunk graph is a flat retrieval-expansion + context structure.

It began as a SimSimi-style lexical matcher (`exact → FTS → trigram`). That cascade is **deleted**
(`@cosimi/matcher` → `@cosimi/retriever`). A dormant lexical/teach surface still lingers in
`playgrounds/api` + the env schema + early migrations, slated for removal — see "Legacy surface".

## Tech stack

- **Runtime:** Node.js 22, pnpm 11 (pinned via `packageManager`), Turbo 2.
- **Backend:** Hono on Node + Cloudflare Workers. Postgres 16 + `pgvector` (hnsw).
- **Embeddings:** one 1024-dim space — ollama `bge-m3` (dev/offline) / Workers AI `@cf/baai/bge-m3` (prod).
- **Offline LLM:** Anthropic (Sonnet generate / Haiku audit). Never on the query path.
- **Frontend:** Vite + React, shadcn-ui + TanStack Router/Query, Tailwind v4 (CSS-first, no JS config).
- **Tooling:** TypeScript 5.7, oxlint + oxfmt, tsx, valibot, pino, vitest.

## Monorepo layout

```
packages/                  # the published constellation + private tooling
  sdk/            # @cosimi/sdk — facade createCosimi(config); runtime retrieve + ./offline ingest entries
  core/           # @cosimi/core — DTOs, valibot env schema, ports (Embedding/LLM), branding
  retriever/      # @cosimi/retriever — the deterministic retrieval algorithm (two-pool ANN + graph walk)
  normalizer/     # NFC + lowercase + whitespace (preserves diacritics)
  db-core/        # @cosimi/db-core — repository ports, migrations, migrate CLI, applyMigrations()
  adapter-postgres/        # request-scoped/pooled client + repos + seed/provision scripts (peerDep: postgres)
  adapter-embed-ollama/    # EmbeddingPort over a local ollama daemon (bge-m3) — dev + offline
  adapter-embed-workers-ai/# EmbeddingPort over a Cloudflare Workers AI binding — prod
  adapter-embed-fake/      # deterministic in-process embedder for tests
  adapter-llm-anthropic/   # LLMPort over Anthropic Messages (offline generate/audit)
  adapter-llm-fake/        # scripted LLMPort for tests
  adapter-storage/ adapter-r2/  # StorageRepository — local FS (dev) / R2 (prod)
  logger/         # pino + redactInput()
  tsconfig/ oxlint-config/ template/   # private tooling (never published)
playgrounds/               # reference apps that consume @cosimi/sdk (NOT published)
  api/         # public retrieval REST + SSE; POST /retrieve. Node + Workers entries. (legacy chat/teach dormant)
  admin-api/   # internal ingest + corpus REST; binds 127.0.0.1
  lab/         # single internal UI (Vite + React + shadcn-ui): Retrieve, Ingest, Documents, Fallback, Corpus
apps/
  portf/       # portfolio app (TanStack Start); extracted to the 8bu.dev repo in a later cycle
seeds/                     # legacy hand-curated / chatterbot pair seeds (SimSimi era)
docs/
  ARCHITECTURE.md  # canonical SDK/GraphRAG architecture (read this first)
  DEPLOY.md        # Cloudflare + Hyperdrive + Neon runbook
  superpowers/specs|plans/  # per-sub-project specs + plans (gitignored, local working docs)
```

## SDK constellation

- **Distribution:** hybrid — `@cosimi/*` code packages publish in lockstep (changesets, npm + JSR);
  infra drivers (`postgres`, embedding/LLM/storage clients) are **peerDependencies the consumer
  injects**, never bundled. The adapter pattern *is* the dependency graph.
- **Facade:** `createCosimi(config)` → `CosimiClient` with `retrieve()` + opt-in `healthcheck()`.
  `config.sql` is the injected postgres **accessor** (resolves Workers request-scoped ALS at call
  time) and `config.embedder` is **mandatory** — no module-level state, no I/O at construction,
  Workers-safe. `playgrounds/api` dogfoods it for `/retrieve`.
- **Runtime/offline split:** `@cosimi/sdk` (runtime: retrieve, Workers-safe) vs `@cosimi/sdk/offline`
  (Node-only ingest pipeline). Subpath `exports` keep LLM-heavy offline deps out of the Workers bundle.
- **Publish is operator-gated:** packages keep `private: true`; go-live = remove private + per-package
  dist builds + `jsr.json`, then `pnpm release`.

Full design in **`docs/ARCHITECTURE.md`** (retrieval algorithm, ingest pipeline, data model).

## Commands

- `pnpm dev` (= `dev:cosimi`) — Docker guard → `db:up --wait` → `migrate` → turbo dev for the
  cosimi playgrounds (api + admin-api + lab). `pnpm dev:portf` runs the portfolio stack separately.
- `pnpm db:up` / `db:down` / `db:reset` — Postgres dev container (`cosimi-postgres`).
- `pnpm migrate` (up) — applies all numbered migrations incl. the pgvector graph schema; no flag.
  For `status`/`reset` use `pnpm --filter @cosimi/db-core migrate <sub>`.
- `pnpm typecheck` / `lint` / `format:check` / `test` / `build` — turbo fan-out.
- DB tests race when parallel: `pnpm -r --workspace-concurrency=1 test`.

## Conventions

### Workspace & supply chain

- Workspace packages `@cosimi/<name>`, `private: true`. Import via `@cosimi/...`; never relative
  across packages. `link-workspace-packages=true` makes self-imports work.
- `@cosimi/adapter-postgres` internal subpath imports use `#client`, `#repositories/*`, `#scripts/*`.
  Outside the package, always `@cosimi/adapter-postgres`.
- `pnpm-workspace.yaml` has `minimumReleaseAge: 10080` (7-day embargo). Force-include via
  `minimumReleaseAgeExclude` only with a comment.
- `allowBuilds` = postinstall permission list. Each entry runs install-time code; add deliberately
  with a `# why` comment. No wildcards.

### Architecture & security

- `playgrounds/api` and `playgrounds/admin-api` are **separate processes**. admin-api binds
  `127.0.0.1`; process split + network-layer gate IS the auth contract — don't add app-layer auth
  to admin routes. No `/admin/*` route prefix.
- **No LLM at runtime** in `playgrounds/api`. `@cosimi/retriever` (vector + graph) is the only
  reply source; any LLM/RAG synthesis is the downstream consumer's job.
- **The Anthropic key is client-managed.** Offline ingest needs an LLM key; it's entered in the lab
  (localStorage), sent per request via `X-Anthropic-Key`, and **never** read from env, persisted, or
  logged. Any new ingest/job path must keep it in-memory only.
- Env via `loadEnv()` from `@cosimi/core` — called once at startup, never at import time. Never
  `export const env = loadEnv()` (breaks test env injection). On Workers this is doubly load-bearing:
  deploy-time startup validation runs global scope with NO bindings, so any import-time `loadEnv()`
  fails. The api logger is a lazy `Proxy` for this reason.
- **Workers deploy** (`playgrounds/api`): SAME `src/worker.ts` entry; `src/index.ts` is the Node
  entry. Runbook + Workers traps in `docs/DEPLOY.md`. pino logs are invisible to `wrangler tail` —
  only `console.*` surfaces.

### Database & migrations

- `sql()` from `@cosimi/adapter-postgres` returns a request-scoped client on Workers, else a
  process-level singleton pool (Node dev/prod/tests). The Worker entry wraps `fetch`/`scheduled` in
  `runWithRequestDb(fn)` (an `AsyncLocalStorage` per-request client) — workerd binds each socket to
  the request that opened it. Never create a module-level connection; any new Workers entrypoint
  touching the DB MUST run inside `runWithRequestDb`. Don't `end()` the request client.
- Migrations in `packages/db-core/migrations/` numbered, additive, **never rewritten after merge**.
  New changes → new file. The pgvector graph schema (`012_graph_schema.sql`, `013_ingest_jobs.sql`)
  ships in the **default sequence** — every target gets it, every target needs the `vector`
  extension (dev container, test image, Neon all have it). No gated/`tier23` set. `migrate reset`
  is dev-only (`NODE_ENV !== 'production'`).
- **Canonical write path for `pairs`**: `insertPair` / `insertManyPairs` from
  `@cosimi/adapter-postgres`. Never raw `INSERT INTO pairs`. Both omit `normalized_unaccented`
  (Postgres rejects explicit values) and accept optional `tx`; inside `.begin()` MUST pass `tx`.
- `pairs.normalized_unaccented` is `GENERATED ALWAYS AS (f_unaccent(normalized_input)) STORED`.
- **BIGSERIAL ids round-trip as strings via postgres.js.** Cast at the write boundary:
  `RETURNING id::int AS id`. Chunk/document/job ids are uuids.
- Interval arithmetic: `${n} * INTERVAL '1 unit'`. Never `(n || ' unit')::interval`.

### Retrieval (`@cosimi/retriever`)

- **Pairs and chunks are equal embedded targets.** `retrieve(sql, opts)` runs two ANN sub-selects
  (top-`seedK` pairs filtered `audit_status='pass'` / `deleted_at IS NULL` / locale; top-`seedK`
  chunks), floors by `minSimilarity`, `UNION ALL`, ranks `(similarity DESC, kind ASC, id ASC)`,
  takes `topK`. Returns `{ hits: (PairHit | ChunkHit)[] }`.
- A **pair-hit** carries its source chunk + graph neighbors (`≤ maxHops`, root-carrying recursive
  CTE with `CYCLE` guard) as context; a **chunk-hit** carries its linked pairs.
- **Deterministic:** no top-K random pick, no jitter. Cosine = `1 - (embedding <=> q)`. The
  chunk↔pair link (`chunk_pair_map`) is for context only — it does NOT gate a pair match.
- Knobs default from env (`RETRIEVE_TOP_K`/`SEED_K`/`MAX_HOPS`/`MIN_SIMILARITY` = 0.45), overridable
  per call. Caller embeds the raw query ONCE; the retriever is adapter-agnostic (takes the accessor).

### Offline ingest (`@cosimi/sdk/offline`)

- `createIngestService(deps, options).ingest(input)` — pure orchestrator, all I/O injected. Stages:
  store → chunk+embed → relations (LLM) → generate (LLM, per leaf chunk) → audit (LLM) → optional
  reverse-check. Two models: Sonnet (generate/relations), Haiku (audit).
- **Chunking is single-axis dispatch:** headed markdown → structural `chunkMarkdown` (one chunk per
  `##`/`###`; over-token sections → `PARENT_OF` parent + sentence children; **no text overlap** —
  continuity is the graph; empty container headings emit no chunk). Headingless → semantic
  `chunkByEmbedding`.
- **Pair-gen gates fact-poor chunks:** skip below `minGenTokens` (default 12) before the LLM call;
  the prompt may also return `[]`. Each pair links to its source chunk (`chunk_pair_map`) + embeds.
- **Progress:** the orchestrator emits `onProgress` (injected via deps) through chunk/generate/audit.
- **Async by default (admin-api):** `POST /ingest` → `202 { jobId }`; the pipeline runs **detached
  in-process** and mirrors progress to the durable `ingest_jobs` row; the lab polls
  `GET /ingest/jobs/:id`. In-process is deliberate — the Anthropic key lives only in the job's
  memory closure, so a durable cross-process queue (which would persist the key) is the wrong fit.
  Boot sweeps any `running` job → `error`.

### playgrounds/api

- **Primary: `POST /retrieve`** (`routes/retrieve.ts`) — dogfoods `createCosimi(...).retrieve()`,
  returns unified `{ hits }`; empty hits upsert an `unanswered` (source `retrieve`) fallback row.
- **Legacy surface (dormant, slated for removal):** `routes/chat.ts` (SSE), `feedback.ts`,
  `services/{chat-handler,teach-handler,teach-parser,rate-limit}`, `lib/{session,gc,sse}`. The chat
  match branch is stubbed to `no_match`. Don't build new features on it; touch only to delete.
- `/healthz` runs a 1s-budgeted DB ping; timeout `.unref()`'d + cleared in `finally`. Shape
  `{ ok, db, db_latency_ms, uptime_s }`. Two near-identical files (api + admin-api) — touch both.

### playgrounds/admin-api

- Loopback-only. Routes: `/ingest` (async, see above), `/documents` (+ `DELETE /:id` purges
  document → chunks → generated pairs), `/import`, `/pairs`, `/rollback`, `/stats`, `/unanswered`,
  corpus reads (`/documents/:id/chunks`, `/chunks/:id/pairs`), `/teach-queue` (legacy).
- `DELETE /documents/:id` hard-deletes the generated pairs (the FK cascade would orphan them) inside
  one transaction; pairs are 1:1-owned by their generating chunk.
- `/import` JSONL reads `c.req.raw.body!.getReader()` directly (OOM-safe at 10k rows); `FLUSH_AT=500`.
  Accumulates a `Set` of normalized inputs, then one `DELETE FROM unanswered WHERE … = ANY(...)`.
- `POST /pairs` atomically deletes matching `unanswered` rows in the same transaction. Any new write
  site must include the cleanup. `/rollback` is soft-delete only (`deleted_at`), re-runs are no-ops.
- `ingest_jobs` helpers in `src/lib/ingest-jobs.ts` (raw `sql()`); the route injects `onProgress`
  into the SDK deps. The key is never written to the row.

### playgrounds/lab

- Single Vite + React + shadcn-ui app (merges the former `web` + `admin`). Feature-organized:
  `src/features/<name>/{hooks,store,components}` for `corpus | documents | fallback | ingest |
  retrieve`. File-based TanStack Router (`src/routes/*`, generated `routeTree.gen.ts`); TanStack
  Query; zustand; Phosphor icons; Space Grotesk.
- **Two backends:** `config/bases.ts` (`API_BASE` → :3000 retrieve, `ADMIN_BASE` → :3001 admin) via
  Vite dev proxy. `lib/api/admin-client.ts` is the admin fetch layer; retrieve has its own client.
- **Anthropic key** lives in `config/anthropic-key.ts` (localStorage `cosimi.config.anthropicKey`),
  attached as `X-Anthropic-Key` on ingest only. Never logged, never sent elsewhere.
- **Ingest is async:** the form starts a job and polls `useIngestJob` (1.5s while `running`),
  rendering `JobProgress`; on `done` → toast + invalidate `["documents"]`.
- shadcn primitives are **copied** under `src/components/ui/*` (NOT a shared package). `<ConfirmDialog>`
  is the destructive-action gate. Toast-first errors (`sonner`); `<Toaster />` mounts at the React root.

### Locale

- Default `'und'` everywhere (`pairs`, `teach_queue`, etc.). Retrieval filters
  `(locale = ANY(locales) OR locale = 'und')`. Canonical write path forwards locale; any new write
  site must thread it through. `app_config[fallback_message_<locale>]` is the no-match line.

### Logging

- PII redaction is belt-and-suspenders. `@cosimi/logger.createLogger()` ships a `redact.paths` list;
  `redactInput(text)` → `{ length, hash: sha256[..8] }`. INFO+: use `redactInput()` if logging text;
  DEBUG raw values go under `*_dbg` suffixes. App loggers are thin `createLogger('<app>')` re-exports
  — never construct pino directly. Exception: `playgrounds/api/src/lib/logger.ts` is a lazy `Proxy`
  that defers `createLogger()` (hence `loadEnv()`) to first use, so the Workers bundle survives
  import-time deploy validation.

### Tests

- `cosimi_test` is the shared DB (api, admin-api, sdk, retriever, adapter-postgres). Each has a
  vitest `globalSetup` that DROPs `public` and `applyMigrations(db)` — one call, the full sequence
  (graph schema included; no separate tier23 step).
- DB-touching vitest config: `pool: 'threads'`, `singleThread: true`, `fileParallelism: false`. Run
  `pnpm -r --workspace-concurrency=1 test` — otherwise they race. `lab` is DB-free (jsdom),
  parallel-safe.
- Fixtures go through `insertManyPairs`, never raw INSERT. **SSE responses must be drained** in api
  tests before dependent follow-ups (`drain`/`consumeChatStream` from `test/helpers.ts`).
- Lab component tests: jsdom + `@testing-library/react` + `userEvent.setup()`; per-test `cleanup()`
  in `afterEach` is mandatory. Mock via `vi.hoisted` + `vi.mock`, then `await import(...)` AFTER the
  mock. `userEvent` deadlocks under fake timers — use `fireEvent` there.

### UI primitives & styling

- Tailwind v4 is CSS-first (no `tailwind.config.{ts,js}`); config in `src/index.css` / `globals.css`
  with `@import "tailwindcss"`, the shadcn base, and `@theme` tokens. Vite plugin `@tailwindcss/vite`.
- **Theme:** `[data-theme="dark"|"light"]` on `<html>` wins unconditionally; the media query matches
  only when `:root:not([data-theme])`. `bootstrapTheme()` runs from `main.tsx` before render.
- Reduced-motion is a token-layer concern (global `@media (prefers-reduced-motion)` clamps durations).
- Enum-pick UI: native `<select>` with token styling. Keyboard shortcuts scope to the view's outer
  `<section ref tabIndex={-1}>`, never `window.addEventListener` (except the `?` cheatsheet).

### Legacy surface (being removed)

The SimSimi-era lexical/teach machinery still exists but is dormant: the `/chat` SSE + `/teach`
parser + sessions/GC in `playgrounds/api`; the `teach_queue`, `votes`, `sessions`,
`session_teaches` tables + early migrations; the `seeds/` corpora; and the `TEACH_*`, `SSE_*`,
`SESSION_*`, `EXPOSE_MATCH_INSIGHTS`, `FALLBACK_MESSAGE`, `GC_INTERVAL_MS`, `PRUNE_SCORE_THRESHOLD`
env keys. Don't extend it. A dedicated cleanup cuts a fresh GraphRAG baseline.

## Project status

GraphRAG pivot on branch `phase-sdk-sp2-m1` (milestones stacked, no per-phase PR). Shipped: the
deterministic retrieval engine, the async offline ingest pipeline, the lab product, the Workers AI
embedder, async ingest jobs, document cleanup. Standing gates: `pnpm -r typecheck`, `pnpm lint`,
`pnpm format:check`, `pnpm -r --workspace-concurrency=1 test`.

**Deploy:** all-Cloudflare (Pages + Workers → Hyperdrive → Neon), manual via `./deploy.sh`; see
`docs/DEPLOY.md`. **Next:** remove the legacy lexical/teach surface + cut a clean schema baseline;
extract `apps/portf` to its own repo as a `@cosimi/sdk` consumer.

**Out of scope (for now):** runtime RAG/LLM answer synthesis (the consumer's job); hybrid
vector+keyword retrieval; cross-document graph links; re-ranking models; multi-user accounts;
observability dashboards; UI-chrome i18n (admin chrome English-only).
