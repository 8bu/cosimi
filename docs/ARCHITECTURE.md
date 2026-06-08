# Cosimi — Architecture

> Canonical architecture doc for the SDK / GraphRAG era. Replaces the old
> SimSimi-app docs and the former `NEW_ARCHITECTURE.md` umbrella.

## What it is

Cosimi is a deterministic, **LLM-free-at-query-time**, GraphRAG-*inspired* retrieval SDK. You
ingest documents **offline** (an LLM turns source text into a chunk graph + Q&A pairs); at
**runtime** `retrieve(query)` returns a ranked, deterministic structure — no LLM, no random
jitter, same query + same data → same result. The consumer owns any downstream RAG/LLM step,
or uses the pre-generated pairs directly as answers.

> **GraphRAG-*inspired*, not Microsoft GraphRAG.** No entity extraction, community detection,
> hierarchical summaries, or global/local search modes. The "graph" is a flat chunk-relation
> structure used only for **retrieval expansion** and context augmentation.

It began as a SimSimi-style lexical matcher (`exact → FTS → trigram` cascade over a curated
pair store). That cascade is **deleted**. Same offline spine (an LLM generates pairs from
source docs); a completely different query path (vector + graph, not lexical tiers).

## Two surfaces

| Surface | Entry | Runtime | Uses an LLM? |
|---|---|---|---|
| **Offline ingest** | `@cosimi/sdk/offline` | Node only | **Yes** (generate + audit) |
| **Runtime retrieve** | `@cosimi/sdk` | Node **or** Cloudflare Workers | No — deterministic |

The subpath `exports` keep the LLM-heavy offline deps out of the Workers runtime bundle.

```ts
import { createCosimi } from "@cosimi/sdk";
import { sql } from "@cosimi/adapter-postgres";
import { createOllamaEmbedder } from "@cosimi/adapter-embed-ollama";

const cosimi = createCosimi({ sql, embedder: createOllamaEmbedder({ baseUrl }) }); // embedder MANDATORY
const result = await cosimi.retrieve("how long do refunds take?", {
  topK: 8, seedK: 4, maxHops: 2, minSimilarity: 0.45,
});
// result.hits: ranked (PairHit | ChunkHit)[] — see "Retrieval" below.
```

`createCosimi(config)` does **no I/O at construction** (Workers-safe). It validates the embedder
dimension against `EMBEDDING_DIM` and returns a client with `retrieve()` and an opt-in
`healthcheck()`. `config.sql` is an **accessor** (`() => client`), resolved at call time so the
SDK holds no module-level connection.

## Retrieval (`@cosimi/retriever`)

Pairs and chunks are **equal, first-class embedded targets** — the chunk↔pair link exists only
for context augmentation, not gating (this reverses the earlier chunk-anchored model). One
`retrieve(sql, opts)` call:

1. **Seed (two ANN pools).** Two index-friendly sub-selects — top-`seedK` nearest **pairs**
   (`audit_status='pass'`, `deleted_at IS NULL`, locale-filtered) and top-`seedK` nearest
   **chunks** — each keeps its hnsw index. Floor by `minSimilarity`, `UNION ALL`, rank by
   `(similarity DESC, kind ASC, id ASC)`, take `topK`.
2. **Augment.** A **pair-hit** carries its source chunk + that chunk's graph neighbors
   (`≤ maxHops`, via a root-carrying recursive CTE with `CYCLE` guard). A **chunk-hit** carries
   its linked pairs.
3. **Return** `{ hits: (PairHit | ChunkHit)[] }`.

Cosine similarity is `1 - (embedding <=> q)`. Deterministic: no top-K random pick, no jitter.
The numeric knobs default from env (`RETRIEVE_TOP_K`, `RETRIEVE_SEED_K`, `RETRIEVE_MAX_HOPS`,
`RETRIEVE_MIN_SIMILARITY` = 0.45) and are overridable per call.

## Offline ingest (`@cosimi/sdk/offline`)

`createIngestService(deps, options).ingest(input)` — pure orchestrator, all I/O injected:

1. **Store + record** the raw document (object storage + `documents` row).
2. **Chunk** (single-axis dispatch): headed markdown → structural `chunkMarkdown` (one chunk per
   `##`/`###` section; over-token sections split into a `PARENT_OF` parent + sentence-grouped
   children; **no text overlap** — continuity is the graph; empty container headings emit no
   chunk). Headingless text → semantic `chunkByEmbedding` (sentence embeddings, cut on cosine
   drop). Embed + persist chunks.
3. **Relations** — an LLM links leaf chunks (`REFERENCES`/`ELABORATES`/`CONTRADICTS` edges).
4. **Generate** — an LLM emits Q&A pairs per leaf chunk. Fact-poor chunks are skipped (token
   gate `minGenTokens`, default 12) and the prompt may return `[]`; each pair links to its
   source chunk (`chunk_pair_map`) + embeds.
5. **Audit** — a stricter LLM pass: `pass` keeps, `fail` soft-deletes, `rewrite` fixes +
   re-embeds. Optional **reverse-check** flags pairs whose answer doesn't round-trip to a
   matching question.

Two models: Sonnet (generate/relations), Haiku (audit/reverse). **Async by default** — see below.

### Async ingest jobs

`POST /ingest` (admin-api) returns `202 { jobId }` immediately; the pipeline runs **detached in
the process** and mirrors progress to a durable `ingest_jobs` row (`stage` + chunk/pair
counters). The UI polls `GET /ingest/jobs/:id`. Execution is **in-process on purpose**: the
Anthropic key lives only in the job's memory closure and is never persisted, so a durable
cross-process queue (which would have to store the key to resume) is the wrong fit. On boot,
admin-api sweeps any leftover `running` job → `error` (in-memory work can't survive a restart).

## Data model

All migrations in `packages/db-core/migrations/` (numbered, additive, never rewritten after
merge). The graph/vector schema is part of the **default sequence** (`012_graph_schema.sql`,
`013_ingest_jobs.sql`) — every target gets it; every target needs the `vector` extension (the
dev container, the test image, and Neon all have it). There is no separate gated migration set.

- `documents` — metadata; raw bytes in object storage.
- `chunks` — `content`, `section_title`, `embedding vector(1024)` (hnsw `vector_cosine_ops`).
- `chunk_relations` — directed edges (`PARENT_OF`, `REFERENCES`, …) backing the graph walk.
- `pairs` — the Q&A store: `input`/`response` + `embedding vector(1024)`, `audit_status`,
  `source_chunk`. Reuses the original BIGSERIAL-keyed table (extended, not replaced).
- `chunk_pair_map` — pair ↔ source chunk.
- `ingest_jobs` — async ingest status/progress (no key, ever).

## The constellation

Hybrid distribution: `@cosimi/*` **code** packages publish in lockstep (changesets, npm + JSR);
**infra drivers** (postgres, embedding/LLM/storage clients) are **peerDependencies the consumer
injects**, never bundled — the adapter pattern *is* the dependency graph, and the SDK stays
Workers-safe.

| Package | Role |
|---|---|
| `@cosimi/sdk` | Facade `createCosimi(config)` + `./offline` ingest entry. Primary consumer entry. |
| `@cosimi/core` | DTOs, valibot env schema, ports (`EmbeddingPort`/`LLMPort`), branding. Dep-free. |
| `@cosimi/retriever` | The deterministic retrieval algorithm (two-pool ANN + recursive graph walk). |
| `@cosimi/normalizer` | NFC + lowercase + whitespace (preserves diacritics). |
| `@cosimi/db-core` | Repository ports, migrations, migrate CLI, `applyMigrations()`. No driver. |
| `@cosimi/adapter-postgres` | Document/chunk/graph/pair repos over `postgres` + pgvector (peerDep). |
| `@cosimi/adapter-embed-ollama` / `-workers-ai` / `-fake` | `EmbeddingPort` — dev/offline, prod, tests. |
| `@cosimi/adapter-llm-anthropic` / `-fake` | `LLMPort` — offline generate/audit, tests. |
| `@cosimi/adapter-storage` / `@cosimi/adapter-r2` | `StorageRepository` — local FS dev, R2 prod. |
| `@cosimi/logger` | pino + `redactInput()` PII redaction. |

Workspace-private tooling (never published): `tsconfig`, `oxlint-config`, `template`.

## Runtime DB split (Node vs Workers)

`sql()` from `@cosimi/adapter-postgres` returns a **process-level singleton pool** on Node
(dev/prod/tests) and a **request-scoped client** on Cloudflare Workers. workerd binds each
socket to the request that opened it, so a Worker entry wraps `fetch`/`scheduled` in
`runWithRequestDb(fn)` (an `AsyncLocalStorage` per-request client). **Never** create a
module-level connection; any Workers entrypoint touching the DB must run inside
`runWithRequestDb`. `loadEnv()` is called once at startup, never at import time — on Workers,
deploy-time global-scope validation runs with no bindings, so an import-time `loadEnv()` would
throw.

## Playgrounds (reference apps — consume `@cosimi/sdk`, not published)

| App | Role | Port |
|---|---|---|
| `playgrounds/api` | Public retrieval REST — `POST /retrieve` (deterministic JSON). Node + Workers entries. | 3000 |
| `playgrounds/admin-api` | Internal ingest + corpus REST — async `/ingest`, `/documents`, `/import`, chunk/pair/fallback reads. Loopback-only. | 3001 |
| `playgrounds/lab` | Single internal UI — Retrieve, Ingest, Documents, Fallback, Corpus. Vite + React + shadcn-ui + TanStack Router/Query, Tailwind v4. | 5173 |
| `playgrounds/neolab` | KB-console rebuild (Pavilion redesign) — same 5 screens. React 19 + Base UI + TanStack Router/Query + zustand, Tailwind v4. The lab successor; runs beside lab until cutover. | 5174 |

The two API processes are **separate by design**: admin-api binds `127.0.0.1` — the process
split + network gate **is** the auth contract (no app-layer auth on the admin surface, no
`/admin/*` route prefix).

## Deploy

All-Cloudflare, manual via `./deploy.sh` — Pages (lab/UI) + Workers (api) → Hyperdrive → Neon
Postgres. Full runbook + Workers traps in [`DEPLOY.md`](./DEPLOY.md).

## Status

GraphRAG-only. Shipped: the retrieval engine, the async offline ingest pipeline, the lab product,
the Workers AI embedder, and the subtraction pass that removed the SimSimi lexical/teach/chat
surface (routes, services, the `teach_queue`/`votes`/`sessions`/`session_teaches` tables + their
migrations, env keys, seeds, `adapter-r2`). The portfolio app has been **extracted** to its own repo
(`8bu.dev`, own backend) and removed from cosimi (only its held Cloudflare deploy config remains,
pending 8bu.dev's own deploy). Publishing is operator-gated (packages stay `private` until go-live).
