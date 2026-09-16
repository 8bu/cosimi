# cosimi — Architecture

cosimi is a self-hosted answer engine: it distils documents into an LLM-verified Q&A index offline and
answers from it deterministically — no LLM in the request path. Offline, on Node, an LLM splits documents
into chunks, generates Q&A pairs from each chunk, and audits them with a second LLM pass; chunks and pairs
are embedded into one 1024-dim space (bge-m3 via pgvector) in Postgres. At query time `retrieve(query)`
embeds the query once and returns the top-K nearest pairs and chunks by cosine similarity: same query,
same data, same hits.

> This document describes the tree **as it is today** (SDK constellation + Cloudflare Workers entry). The
> target shape and the phases to get there are in [`ROADMAP.md`](./ROADMAP.md); this file is rewritten as
> Phase 0 lands.

## Two surfaces

| Surface | Entry | Runtime | Uses an LLM? |
|---|---|---|---|
| **Offline ingest** | `@cosimi/sdk/offline` | Node only | Yes — pairs, chunk links, audit |
| **Runtime retrieve** | `@cosimi/sdk` | Node or Cloudflare Workers | No — deterministic |

The subpath `exports` in `packages/sdk/package.json` keep the LLM-heavy offline deps out of the Workers bundle.

```ts
import { createCosimi } from "@cosimi/sdk";
import { sql } from "@cosimi/adapter-postgres";
import { createOllamaEmbedder } from "@cosimi/adapter-embed-ollama";

const cosimi = createCosimi({ sql, embedder: createOllamaEmbedder({ baseUrl }) }); // embedder mandatory
const { hits } = await cosimi.retrieve("how long do refunds take?", { topK: 8, seedK: 4, maxHops: 2, minSimilarity: 0.45 });
```

`createCosimi(config)` does no database I/O at construction. `config.sql` is the postgres **accessor**
(`SqlAccessor`), so the Workers request scope resolves at call time; `config.embedder` is mandatory, and
construction asserts `embedder.dimension === EMBEDDING_DIM` (1024). The client also exposes `healthcheck()`.

## Retrieval

`retrieve(sql, opts)` lives in `@cosimi/retriever`; the SDK calls it. `RetrievalService` embeds the raw
query once and passes the vector down; pairs and chunks are equal embedded targets.

1. **Rank.** Two index-friendly ANN sub-selects run in one query, each keeping its hnsw index: the top
   `seedK` nearest **pairs** (`embedding IS NOT NULL AND deleted_at IS NULL AND audit_status = 'pass'`, plus
   a locale filter that keeps rows in `locales` and rows tagged `'und'`) and the top `seedK` nearest
   **chunks**. Similarity is `1 - (embedding <=> q)`. Both pools are floored at `minSimilarity`, merged by
   `UNION ALL`, ranked `(similarity DESC, kind ASC, id ASC)`, and cut to `topK`.
2. **Attach context.** A **pair hit** carries `context`: its source chunk (via `chunk_pair_map`) plus the
   chunks linked from it within `maxHops` — an undirected recursive walk over `chunk_relations` with a
   `CYCLE` guard. A **chunk hit** carries `pairs`: its live, passing, locale-eligible pairs, sorted by
   similarity. Links never affect ranking; ranking is cosine only.
3. **Return** `{ hits }` — a `PairHit` (`kind`, `similarity`, `input`, `response`, `context`) or a
   `ChunkHit` (`kind`, `similarity`, `chunk`, `pairs`). Nothing clearing the floor returns `{ hits: [] }`,
   and the public api then upserts the query into `unanswered` with `source = 'retrieve'`.

Knobs default from `EnvSchema` in `@cosimi/core` — `RETRIEVE_TOP_K` (8), `RETRIEVE_SEED_K` (4),
`RETRIEVE_MAX_HOPS` (2), `RETRIEVE_MIN_SIMILARITY` (0.45) — and are overridable per call.

## Offline ingest

`createIngestService(deps, options).ingest(input)` is a pure orchestrator with all I/O injected.

1. **Store** — upload the bytes through `StorageRepository`, then create the `documents` row.
2. **Chunk and embed** — `chunk(text, mimeType, embedder, opts)` dispatches on one axis. Markdown with
   headings goes to `chunkMarkdown`: one chunk per `##`/`###` section, and a section above `splitThreshold`
   tokens (default 600) becomes a parent holding the heading plus lead sentence with sentence-grouped
   children linked `PARENT_OF` — no text overlap. Headingless text goes to `chunkByEmbedding`, which cuts
   sentence embeddings at the weakest seam. Chunks are embedded and persisted parent-first, with `PARENT_OF`
   edges written as they are created.
3. **Chunk links (LLM)** — `extractRelations` runs over leaf chunks and writes
   `REFERENCES`/`ELABORATES`/`CONTRADICTS` edges to `chunk_relations`; structural parents are not a source.
4. **Generate pairs (LLM)** — per leaf chunk. Chunks below `minGenTokens` (default 12) are skipped before
   the call and the prompt may return none; each pair is inserted, embedded from its `question: answer`
   text, mapped to its source chunk, and left `pending`.
5. **Audit (LLM)** — `auditPair` per candidate: `pass` keeps, `fail` soft-deletes, `rewrite` replaces the
   response and re-embeds the pair.
6. **Reverse-check (optional)** — `reverseCheck` flags passed pairs whose answer misses its question.

`INGEST_GENERATE_MODEL` (`claude-sonnet-4-6`) drives pair generation and chunk links; `INGEST_AUDIT_MODEL`
(`claude-haiku-4-5-20251001`) drives audit and reverse-check.

### Async ingest jobs

`POST /ingest` (admin-api) returns `202 { jobId }` immediately; the pipeline runs detached in the process and
mirrors progress to the `ingest_jobs` row that the UI polls via `GET /ingest/jobs/:id` (`GET /ingest/jobs`
lists recent jobs). In-process execution is deliberate: the Anthropic key arrives in the `X-Anthropic-Key`
header and lives only in the job's memory closure — never in env, a row, or a log. Since that work cannot
survive a restart, admin-api boot sweeps leftover `running` jobs to `error`.

## Data model

Migrations in `packages/db-core/migrations/` are numbered, additive, and never rewritten after merge.
`012_graph_schema.sql` and `013_ingest_jobs.sql` ship in the default sequence, so every target needs the
`vector` extension.

- `documents` — title, mime type, storage key; bytes stay in object storage.
- `chunks` — `content`, `chunk_index`, `section_title`, `embedding vector(1024)` (hnsw cosine index).
- `chunk_relations` — one row per directed link (`from_chunk_id`, `to_chunk_id`, `relation_type`).
- `pairs` — `input`/`response`, `embedding vector(1024)`, `audit_status`, `source_chunk`, `locale`.
- `chunk_pair_map` — pair ↔ source chunk; serves pair-hit context and chunk-hit pairs.
- `unanswered` — queries that produced no hits, with `source` (including `'retrieve'`) and a counter.
- `ingest_jobs` — status, stage, counters, error; no key material, no foreign key on `document_id`.

## Packages

`@cosimi/*` code packages publish in lockstep (one changesets `fixed` group; `pnpm release` builds
`packages/*` then runs `changeset publish`). Infra drivers are peerDependencies the consumer injects.

| Package | Role |
|---|---|
| `@cosimi/sdk` | Facade `createCosimi(config)` plus the `./offline` ingest entry. |
| `@cosimi/core` | DTOs, valibot `EnvSchema`, `EmbeddingPort`/`LLMPort` ports. |
| `@cosimi/retriever` | The deterministic retrieval algorithm and `SqlAccessor`. |
| `@cosimi/normalizer` | NFC, lowercase, whitespace normalization (diacritics preserved). |
| `@cosimi/db-core` | Repository ports, migrations, `applyMigrations()`, migrate CLI. |
| `@cosimi/adapter-postgres` | `sql()` / `runWithRequestDb()` plus the postgres repositories. |
| `@cosimi/adapter-embed-ollama` | `EmbeddingPort` over a local ollama daemon (bge-m3). |
| `@cosimi/adapter-embed-workers-ai` | `EmbeddingPort` over a Workers AI binding (production). |
| `@cosimi/adapter-embed-fake` | Deterministic in-process embedder for tests. |
| `@cosimi/adapter-llm-anthropic` | `LLMPort` over the Anthropic Messages API (offline only). |
| `@cosimi/adapter-llm-fake` | Scripted `LLMPort` for tests. |
| `@cosimi/adapter-storage` | `StorageRepository` over the local filesystem. |
| `@cosimi/logger` | pino factory plus `redactInput()` PII redaction. |

Private tooling, never published: `@cosimi/tsconfig`, `@cosimi/oxlint-config`, `@cosimi/template`.

## Playgrounds

| App | Port | Role |
|---|---|---|
| `@cosimi/api` | 3000 | Public retrieval REST: `POST /retrieve`, `GET /stats`, `GET /healthz`; Node entry `src/index.ts`, Workers entry `src/worker.ts`. |
| `@cosimi/admin-api` | 3001 | Internal ingest and corpus REST: `/ingest` (async), `/documents` (+ `DELETE /:id`), `/pairs`, `/stats`, `/unanswered`, `/documents/:id/chunks`, `/chunks/:id/pairs`, `/healthz`. |
| `@cosimi/lab` | 5173 | Internal UI — Retrieve, Ingest, Documents, Fallback, Corpus — on React 19, Base UI, TanStack Router/Query, zustand, Tailwind v4; Vite proxies `/api` → :3000 and `/admin` → :3001. |

The two API processes are separate by design: admin-api binds `127.0.0.1`, so the process split plus the
network gate is the auth boundary — no app-layer auth on the admin surface and no `/admin/*` prefix.

## Cloudflare Workers constraints

- **Request-scoped database.** `sql()` returns the client installed by `runWithRequestDb(fn)` (an
  `AsyncLocalStorage` scope), else the Node process singleton. The Worker wraps its whole `fetch` handler in
  `runWithRequestDb`; never open a module-level connection and never `end()` the request client.
- **No `loadEnv()` at import time.** Deploy-time startup validation runs global scope with no bindings, so
  `playgrounds/api/src/lib/logger.ts` builds pino behind a lazy `Proxy` and `createCosimi` runs per request.
- **pino output is invisible to `wrangler tail`** — only `console.*` reaches the log stream.
- **Hyperdrive points at the Neon direct endpoint**, not the pooler, so postgres.js prepared statements work.

## Deploy

Everything runs on Cloudflare and deploys manually through `./deploy.sh`: 1 run gates, 2 deploy lab → Pages
project `cosimi-web` (built from `playgrounds/lab/dist`), 3 deploy the `cosimi-api` Worker
(`wrangler deploy -e cosimi`), 4 deploy both, 5 migrate the Neon database (prompts for the Neon direct
connection URL, then `DATABASE_URL=<url> pnpm --filter @cosimi/db-core migrate up`), 6 tail `cosimi-api`,
7 status. The Worker reaches Neon through Hyperdrive config `cosimi-hd`, and `playgrounds/api/wrangler.toml`
defines only `[env.cosimi]`. Creating the Pages project, the Hyperdrive config, and the Neon database is
one-time dashboard/CLI setup, outside the menu.
