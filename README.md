# cosimi — GraphRAG-inspired retrieval SDK

A deterministic, **LLM-free-at-query-time** GraphRAG-*inspired* retrieval SDK. Ingest documents
offline (chunk → build a chunk graph → LLM-generate Q&A pairs → audit → embed); at runtime,
`retrieve(query)` embeds the query, seeds from the nearest chunks, walks the graph, and
returns a **ranked, deterministic** structure of chunks with their linked pairs. The consumer
owns any downstream RAG/LLM step — or uses the pre-generated pairs directly as answers.

## The pivot

Cosimi began as a SimSimi-style lexical pattern-matching chatbot (an `exact → FTS → trigram`
cascade over a curated pair store). It is now a **GraphRAG-inspired retrieval SDK**: no tier
cascade, no runtime LLM, no random jitter — deterministic ranked retrieval over a
document-derived chunk graph. Same offline spine (LLM generates pairs from source docs);
completely different query path.

> **GraphRAG-*inspired*, not Microsoft GraphRAG.** Retrieval = vector-NN chunk seeds → bounded
> walk over chunk relations → ranked chunks with their linked pairs. No community detection,
> hierarchical community summaries, or global/local search modes — the chunk graph is a flat
> retrieval-expansion structure.

## Two surfaces

- **Offline ingest** — `@cosimi/sdk/offline` (Node-only, **uses an LLM**). Documents →
  semantic chunks → chunk graph (`chunk_relations`) → LLM-generated Q&A pairs → audit →
  reverse-check → embeddings. Each pair links to its source chunk (`chunk_pair_map`).
- **Runtime retrieve** — `@cosimi/sdk` (**no LLM, deterministic, Workers-safe**).
  `cosimi.retrieve(query, opts)`: embed the query → top-`seedK` nearest chunks as graph seeds
  → undirected graph expansion (`≤ maxHops`) → rank by `(similarity DESC, hops ASC, id)` →
  return ranked chunks, each carrying its linked pairs. Same query + same data → same result.

```ts
import { createCosimi } from "@cosimi/sdk";
import { sql } from "@cosimi/adapter-postgres";
import { createOllamaEmbedder } from "@cosimi/adapter-embed-ollama";

const cosimi = createCosimi({ sql, embedder: createOllamaEmbedder({ baseUrl }) }); // embedder MANDATORY
const result = await cosimi.retrieve("how long do refunds take?", {
  topK: 8, seedK: 4, maxHops: 2, minSimilarity: 0.45,
});
// result.hits: ranked (PairHit | ChunkHit)[] — a pair-hit carries its source chunk
// + graph-neighbor context; a chunk-hit carries its linked pairs. Pairs and chunks
// are equal embedded targets (the chunk↔pair link is for context, not gating).
```

## Distribution model

Hybrid — `@cosimi/*` **code** packages publish in lockstep (changesets, npm + JSR); **infra
drivers** (postgres, embedding/LLM/storage clients) are **peerDependencies the consumer
injects**, never bundled. This keeps the SDK Workers-safe (the DB layer is runtime-split:
Node pool singleton vs Workers request-scoped client) and makes the adapter pattern *be* the
npm dependency graph. The embedder is **mandatory** at runtime — retrieval needs a query vector.

### Constellation (published `@cosimi/*`)

| Package | Role |
|---|---|
| `@cosimi/sdk` | Facade `createCosimi(config)` + `./offline` ingest entry. Primary consumer entry. |
| `@cosimi/core` | Types, env schema, ports (`EmbeddingPort`/`LLMPort`). Dep-free foundation. |
| `@cosimi/retriever` | The deterministic retrieval algorithm (vector-NN seeds + recursive graph walk). |
| `@cosimi/db-core` | Repository ports, migrations, `applyMigrations()`. No driver. |
| `@cosimi/adapter-postgres` | Document/chunk/graph/pair repos over `postgres` + pgvector (peerDep). |
| `@cosimi/adapter-embed-ollama` | `EmbeddingPort` over a local ollama daemon (bge-m3 / 1024) — dev + offline. |
| `@cosimi/adapter-embed-workers-ai` | `EmbeddingPort` over a Cloudflare Workers AI binding (bge-m3) — prod. |
| `@cosimi/adapter-embed-fake` | Deterministic in-process embedder for tests. |
| `@cosimi/adapter-llm-anthropic` | `LLMPort` over Anthropic Messages (offline generate/audit). |
| `@cosimi/adapter-llm-fake` | Scripted `LLMPort` for tests. |
| `@cosimi/adapter-storage` | `StorageRepository` (local FS, dev/offline). |
| `@cosimi/logger` | pino + `redactInput()` PII redaction. |

Workspace-private (never published): `tsconfig`, `oxlint-config`, `template`. (Branding lives in
`@cosimi/core`; there is no shared UI-token package — shadcn primitives are copied per app.)

## Playgrounds (reference apps — consume `@cosimi/sdk`, not published)

| App | Role | Port |
|---|---|---|
| `playgrounds/api` | Public retrieval REST — `POST /retrieve` (deterministic JSON). Node + Cloudflare Workers entries. | 3000 |
| `playgrounds/admin-api` | Internal ingest + corpus REST — `POST /ingest`, `GET /documents`, chunk/pair/fallback reads. Loopback-only. | 3001 |
| `playgrounds/lab` | Single internal lab UI — Retrieve, Ingest, Documents, Fallback, Corpus. shadcn-ui + TanStack Router; calls both backends via a dev proxy. | 5173 |

The two API processes are **separate** by design: admin-api binds `127.0.0.1` — the process
split + network gate IS the auth contract (no app-layer auth on the admin surface).

## Tech stack

- **Runtime:** Node.js 22, pnpm 11, Turbo 2.
- **Backend:** Hono on Node + Cloudflare Workers. Postgres 16 + `pgvector`.
- **Embeddings:** ollama `bge-m3` (dev) / Cloudflare Workers AI `@cf/baai/bge-m3` (prod) — one 1024-dim vector space.
- **Offline LLM:** Anthropic (Sonnet generate / Haiku audit). Never on the query path.
- **Frontend:** Vite + React, shadcn-ui + TanStack Router/Query, Tailwind v4. TypeScript 5.7, oxlint + oxfmt, vitest.

## Quickstart

```bash
corepack enable
pnpm install
cp .env.example .env

# Embeddings need a local ollama with the bge-m3 model:
ollama serve            # or the desktop app
ollama pull bge-m3

pnpm dev                # docker guard → postgres → migrate → api + admin-api + lab
```

Then drive the loop in the **lab** (http://localhost:5173):
1. **Ingest** → paste your Anthropic API key (stored in your browser, sent per-request — never to
   the server's env) + a markdown document → run it through the offline pipeline.
2. **Retrieve** → ask a question → see the ranked chunks + pre-generated answer, with a **Details**
   sheet of the full retrieval structure and a live tuning panel (`topK`/`seedK`/`maxHops`/`minSimilarity`).
3. **Documents** / **Corpus** browse what was ingested; **Fallback** shows retrieval misses.

## Project status

GraphRAG pivot in progress on branch `phase-sdk-sp2-m1` (milestones stacked, no per-phase PR).
**Shipped:** the deterministic retrieval engine + the async offline ingest pipeline + the lab
product (Retrieve / Ingest / Documents / Fallback / Corpus) + the Workers AI embedder.
Standing gates green (`typecheck`, `lint`, `format:check`, `test`).

The SimSimi lexical/teach/chat surface has been **removed** (routes, services, the
`teach_queue`/`votes`/`sessions`/`session_teaches` tables, env keys, seeds, `adapter-r2`). **Next:**
extract `apps/portf` to its own repo with its own backend. Publishing the `@cosimi/*` packages is
operator-gated (packages stay `private` until go-live).

**Out of scope (for now):** runtime RAG/LLM answer synthesis (the consumer's job); hybrid
vector+keyword retrieval; cross-document graph links; re-ranking models; multi-user accounts;
UI-chrome i18n (admin chrome English-only).

## Docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — canonical architecture: retrieval algorithm, ingest pipeline, data model, the constellation.
- [`CLAUDE.md`](./CLAUDE.md) — codebase map, conventions, invariants (for AI agents + humans).
- [`docs/DEPLOY.md`](./docs/DEPLOY.md) — Cloudflare Workers + Hyperdrive + Neon runbook.

## License

SEE [`LICENSE.md`](./LICENSE.md).
