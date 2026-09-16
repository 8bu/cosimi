# cosimi

A self-hosted answer engine: it distils your documents into an LLM-verified Q&A index offline and answers from it deterministically — no LLM in the request path.

Offline (Node, uses an LLM) documents are chunked, an LLM generates Q&A pairs from each chunk, and a second LLM pass audits them; chunks and pairs are both embedded (bge-m3, 1024-dim, pgvector). At query time (no LLM) `retrieve(query)` embeds the query once and returns the top-K nearest pairs and chunks by cosine similarity — deterministic: same query + same data → same result. Chunk links (`chunk_relations`) exist only as context for a hit, never for ranking — ranking is cosine only.

> **Direction:** cosimi is moving from an SDK constellation to a single self-hosted app. The current
> tree still has the SDK shape described below; the target and phases are in [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## How it works

- **Offline ingest** (`@cosimi/sdk/offline`, Node, uses an LLM): store → chunk → LLM chunk links → LLM Q&A pairs per chunk → LLM audit → embed chunks and pairs.
- **Runtime retrieve** (`@cosimi/sdk`, Node or Workers, no LLM): embed the query once, take the top-`seedK` nearest pairs and chunks, floor by `minSimilarity`, rank by cosine, return the top `topK` hits. A pair hit's `context` carries its source chunk plus linked chunks within `maxHops`.

```ts
import { createCosimi } from "@cosimi/sdk";
import { sql } from "@cosimi/adapter-postgres";
import { createOllamaEmbedder } from "@cosimi/adapter-embed-ollama";

const cosimi = createCosimi({
  sql, embedder: createOllamaEmbedder({ baseUrl: "http://localhost:11434" }), // sql = accessor; embedder mandatory
});
await cosimi.retrieve("how long do refunds take?", { topK: 8, seedK: 4, maxHops: 2, minSimilarity: 0.45 });
```

## Packages

| Package | Role |
|---|---|
| `@cosimi/sdk` | Facade `createCosimi(config)` plus the Node-only `./offline` ingest entry. |
| `@cosimi/core` | Types, env schema, ports (`EmbeddingPort`, `LLMPort`). |
| `@cosimi/retriever` | The deterministic retrieval algorithm over pairs and chunks. |
| `@cosimi/db-core` | Repository ports, numbered SQL migrations, migrate CLI. |
| `@cosimi/normalizer` | Text normalization (NFC, lowercase, whitespace) for ingest and retrieval. |
| `@cosimi/adapter-postgres` | Repositories over postgres + pgvector, request-scoped or pooled. |
| `@cosimi/adapter-embed-ollama`, `@cosimi/adapter-embed-workers-ai`, `@cosimi/adapter-embed-fake` | `EmbeddingPort` over ollama (dev), a Workers AI binding (prod), or a deterministic test embedder. |
| `@cosimi/adapter-llm-anthropic`, `@cosimi/adapter-llm-fake` | `LLMPort` over Anthropic Messages (offline generate/audit) or scripted for tests. |
| `@cosimi/adapter-storage`, `@cosimi/logger` | Local-FS `StorageRepository`; pino logging with `redactInput()` PII redaction. |

Workspace-private tooling (never published): `@cosimi/tsconfig`, `@cosimi/oxlint-config`, `@cosimi/template`. Distribution is hybrid: `@cosimi/*` code packages publish in lockstep via changesets, while infra drivers (`postgres`, the Anthropic SDK) are peerDependencies the consumer injects. Publishing is operator-gated (`pnpm release`) and has not run yet.

## Playgrounds

| App | Port | Role |
|---|---|---|
| `playgrounds/api` | 3000 | Public retrieval REST: `POST /retrieve`, `/stats`, `/healthz`. Node + Cloudflare Workers entries. |
| `playgrounds/admin-api` | 3001 | Internal ingest + corpus REST. Loopback-only (`127.0.0.1`). |
| `playgrounds/lab` | 5173 | The internal UI (`@cosimi/lab`): Retrieve, Ingest, Documents, Fallback, Corpus. |

## Quickstart

```bash
corepack enable
pnpm install
cp .env.example .env
# Embeddings need a local ollama with the bge-m3 model:
ollama serve
ollama pull bge-m3
pnpm dev # docker guard → postgres up → migrate → api + admin-api + lab
```

Then drive the lab at http://localhost:5173:

1. **Ingest** — paste your Anthropic API key (kept in the browser, sent per request as `X-Anthropic-Key`, never read from server env) with a markdown document.
2. **Retrieve** — ask a question and inspect the ranked pairs and chunks.
3. **Documents** / **Corpus** / **Fallback** — browse what was ingested and review retrieval misses.

## Commands

- `pnpm dev` — full local stack (docker guard → `db:up` → `migrate` → turbo dev for `./playgrounds/*`).
- `pnpm db:up` / `db:down` / `db:reset` — dev postgres container.
- `pnpm migrate` — apply pending migrations.
- `pnpm typecheck` / `lint` / `format:check` / `test` / `build` — turbo fan-out (`pnpm -r --workspace-concurrency=1 test` for DB-touching suites).

## Docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — retrieval algorithm, ingest pipeline, data model.
- [`CLAUDE.md`](./CLAUDE.md) — codebase map, conventions, invariants.

## License

See [`LICENSE.md`](./LICENSE.md).
