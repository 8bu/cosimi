# cosimi — Roadmap

## Positioning

**cosimi is a self-hosted answer engine.** It distils your documents into an LLM-verified Q&A index
offline and answers from it deterministically — no LLM in the request path.

The technique is question-indexed retrieval (doc2query / hypothetical-question indexing). cosimi
differs from the framework implementations in three ways: it generates and audits the **answer**, not
just the question; it **serves the audited answer directly**; and misses feed a **curation loop** that
grows the index. Packaging is RAGFlow-like (self-hosted, `docker compose`, UI + API keys); the product
is not — there is no chat-with-your-docs, and that is a deliberate choice.

### Principles

- **Deterministic serving.** Same question + same index → same answer. No LLM, no sampling at query time.
- **Coverage is quality.** With no synthesis step, anything not distilled is a miss. Every phase after
  Phase 0 invests in coverage and confidence before anything else.
- **Measured, not felt.** No retrieval change lands without the eval harness moving or holding.
- **Lightweight.** One Postgres (pgvector) + one app container (+ optional ollama). If a feature needs
  a fourth service, it needs a very good reason.

### Decisions (2026-09-16)

| Question | Decision |
|---|---|
| LLM at query time | No. Deterministic only. |
| Provider credentials | Server-side settings (encrypted): OpenAI-compatible, Anthropic, ollama. The browser-held `X-Anthropic-Key` goes away. |
| Auth | Single admin login (set at first boot) + API keys scoped to the query endpoint. |
| Ingest formats | Markdown, plain text, HTML, PDF text extraction. No layout/OCR parsing. |
| Repo shape | Collapse to `apps/server` + `apps/web` (+ `packages/shared`). Drop the Workers path and all publish tooling. |

## Target architecture

```
apps/
  server/     # one Node process: query API (+ API keys), admin API (+ session auth), ingest jobs, settings
  web/        # the console (today's playgrounds/lab)
packages/
  shared/     # DTOs and API types shared by server and web
docker/       # Dockerfile(s), docker-compose.yml (postgres+pgvector, server, web, optional ollama)
eval/         # fixed question set + harness; runs in CI
```

Removed: `@cosimi/*` publish constellation, `src/worker.ts`, `runWithRequestDb` / AsyncLocalStorage DB
scoping, Hyperdrive, `deploy.sh`, the Workers AI embedder, changesets, the api/admin-api process split.

## Phases

### Phase 0 — Collapse and measure

Goal: a plain Node app with a plain pg pool, a number for retrieval quality, and `docker compose up`.

- Merge `playgrounds/api`, `playgrounds/admin-api` and the `packages/*` runtime into `apps/server`.
  Plain `postgres` pool; delete the Workers entry, ALS scoping, Hyperdrive config, `deploy.sh`,
  Workers AI embedder, changesets/publish config.
- Move `playgrounds/lab` to `apps/web`.
- **Eval harness:** fixed question → expected pair/chunk set; recall@k, MRR, answer-hit rate; runs
  in CI; deterministic. Baseline recorded.
- **Graph decision by data:** measure `maxHops` 0 vs 2 on the harness. No lift → delete
  `chunk_relations`, the relation LLM stage, `RelationType`, and the `maxHops` knob.
- `Dockerfile` + `docker-compose.yml`. Acceptance: fresh clone → `docker compose up` → ingest a
  markdown file → get an answer.

### Phase 1 — Become an app

- Single-admin auth (first-boot password), sessions; API keys for the query endpoint.
- Provider settings in the UI, encrypted at rest: OpenAI-compatible, Anthropic, ollama — for the
  offline LLM and for embeddings. Remove `X-Anthropic-Key`.
- Knowledge bases as the top-level object; documents, chunks and pairs scoped to one.
- Ingest: markdown, text, HTML, PDF text extraction. Jobs move to a queue table (the in-memory
  constraint that forced in-process jobs is gone with the browser key).

### Phase 2 — Coverage and confidence

- Paraphrase fan-out: several question phrasings per pair.
- Pair dedup/merge across chunks.
- Hybrid retrieval: Postgres FTS (BM25-style) fused with vector similarity.
- Extractive fallback: when no pair clears the threshold, return the best chunk labelled as a passage.
- Per-KB confidence calibration from the eval set instead of one global `minSimilarity`.
- Miss queue → "generate pairs for this question from these chunks" → audit → publish.
- Diff-aware re-ingest on document update.

### Phase 3 — Distribution

- Public query API docs; embeddable widget/snippet.
- Per-API-key usage stats; export/backup.
- Versioned images on a registry; upgrade path for the database.

## Non-goals

LLM chat or synthesis at query time; deep document layout parsing (tables, OCR, DOCX layout);
agent workflows; multi-tenant SaaS; competing with RAGFlow on breadth.
