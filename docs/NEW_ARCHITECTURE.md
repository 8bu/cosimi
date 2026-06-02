# Cosimi — Architecture (SDK Era)

> Umbrella architecture document. Supersedes all `SPEC_PHASE_*` and `portf-phase-*` docs.
> Per-sub-project specs live in `docs/superpowers/specs/`.

---

## What Cosimi is

A SimSimi-style pattern-matching chatbot engine. It matches user queries against a
curated Q&A pair store and returns pre-written replies. **No LLM is invoked at runtime.**

**Core invariant:** every reply originates from the pair store. The runtime never
synthesizes a reply. LLMs appear only in the *offline* pipeline (pair generation/audit),
never on the query path.

Cosimi is now packaged as a **published SDK** (`@cosimi/*` on npm + JSR), consumed both by
this repo's reference apps and by external repos (e.g. `8bu.dev`).

---

## Distribution model

**Hybrid: constellation of code packages + peer-dependency infra adapters.**

- **Code → constellation.** Multiple `@cosimi/*` packages published under one scope,
  versioned in lockstep via [changesets]. Consumers mostly import `@cosimi/sdk`, but may
  reach a sub-package directly.
- **Infra drivers → peer adapters.** The postgres driver, embedding client, object storage
  SDK, and LLM clients are **peerDependencies** the consumer installs and injects via config.
  They are never bundled.

### Why peer adapters (not bundled)

- **Runtime portability.** The DB layer is runtime-split: Node uses a pool singleton;
  Cloudflare Workers use a request-scoped client (`AsyncLocalStorage` via `runWithRequestDb`)
  because workerd binds each socket to the request that opened it. A bundled driver + fixed
  connection strategy would reproduce the `Cannot perform I/O on behalf of a different
  request` trap in any Workers consumer. Peer-injected drivers let each consumer wire its
  own runtime.
- **Adapter pattern = dependency graph.** Tier 2/3 (below) mandate env-selected repository
  adapters (storage local/r2, graph postgres/age). Shipping those as separate adapter
  packages with peer-dep drivers makes the adapter pattern *be* the npm dependency graph —
  no separate config mechanism.
- **Bundler health.** Inlining `postgres` breaks `wrangler` bundling and driver dedup.

### Published packages (the constellation)

| Package | Role | Notes |
|---|---|---|
| `@cosimi/sdk` | Facade + service layer | Primary consumer entry. Runtime + `/offline` subpath. |
| `@cosimi/core` | Types, errors, env schema | Merge of former `config` + `types`. Foundational, dep-free. |
| `@cosimi/normalizer` | NFC + lowercase + whitespace | Preserves diacritics. |
| `@cosimi/matcher` | Tier handlers | Tier 1 ships now; Tier 2/3 register later. |
| `@cosimi/db-core` | Repository ports + SQL builders | Interfaces + query construction; no driver. |
| `@cosimi/adapter-postgres` | Pair/Chunk/Graph/Document adapters | peerDep on `postgres`. |
| `@cosimi/adapter-r2` | StorageRepository (r2 \| local) | peerDep on S3-compatible client. |
| `@cosimi/logger` | pino + `redactInput()` | PII redaction. |

Workspace-private (never published): `tsconfig`, `oxlint-config`, `branding`, `ui-tokens`,
`template`.

### Registry + release

- Published to **npm (public)** and **JSR**.
- **changesets** drives version bump + changelog; constellation versions move in lockstep.
- v1: manual `pnpm release` (publishes both registries), matching the current manual-deploy
  posture. CI publish-on-tag is a later addition.

---

## SDK architecture (A+: facade + services + ports, plus a tier registry)

```
createCosimi(config) → CosimiClient
  .match(query, opts)     runtime: tier cascade, Workers-safe
  .teach(...)             runtime: session teach
  .admin.*                pairs / unanswered / rollback / import (Node)
  .ingest.*               offline: document → chunk → pair pipeline (Node, /offline)
```

### Layers

1. **Facade** — `createCosimi(config)` returns a `CosimiClient`. Config carries injected
   adapters (repositories), the tier registry, thresholds, and runtime strategy. The facade
   is the stable public surface; keep it small.
2. **Services** — plain classes (`MatchService`, `TeachService`, `AdminService`,
   `IngestService`). Stable, not pluggable. They orchestrate ports.
3. **Tier registry (the one plugin seam)** — the match cascade is an ordered list of
   `TierHandler`s: `{ name: string; run(ctx): Promise<Reply | null> }`. Short-circuit on the
   first non-null. Tier 1 registers three handlers (exact → FTS → trigram). Tier 2/3 register
   more handlers without touching core. This is where extensibility lives.
4. **Ports** — repository interfaces (`PairRepository`, `ChunkRepository`, `GraphRepository`,
   `StorageRepository`, `DocumentRepository`). No layer touches a driver directly.
5. **Adapters** — concrete port implementations as peer-injected packages.

### Why a tier registry and not a global plugin bus

The extensibility roadmap is two concrete axes — **new match tiers** and **new adapters** —
not "everything". A generic plugin bus (services + lifecycle as plugins) would expose a large
public plugin API that becomes a permanent backwards-compat surface on a *published* SDK, for
a system with a small, stable service set. Scoping the plugin seam to the tier cascade gives
maximum useful extensibility at minimum public-surface cost. Adapters extend via ports.

### Runtime / offline split

```
@cosimi/sdk           runtime entry  → match / teach / admin. No LLM/pdf/ollama deps.
@cosimi/sdk/offline   offline entry  → ingest pipeline. Node-only; pulls LLM clients.
```

Subpath `"exports"` map keeps them separate. A Workers consumer importing bare `@cosimi/sdk`
never bundles offline (LLM-heavy) dependencies. The SDK ships **no module-level DB
connection**; the consumer injects driver + connection strategy (pool vs request-scoped ALS)
through config.

---

## Repository layout (post-refactor)

```
packages/                  # the published constellation + private tooling
  sdk/  core/  normalizer/  matcher/  db-core/
  adapter-postgres/  adapter-r2/  logger/
  tsconfig/  oxlint-config/  branding/  ui-tokens/  template/
playgrounds/               # reference apps that consume @cosimi/sdk (not published)
  api/        runtime adapter (Hono REST + SSE); Node + Workers entries
  admin-api/  offline + admin adapter (Node)
  admin/      admin dashboard (Vite + React)
  web/        reference chat UI (Vite + React)
seeds/                     # curated + chatterbot snapshots
docs/                      # this file + per-sub-project specs
```

`apps/portf` is **extracted** to the separate `8bu.dev` repo (see SP3) and becomes a
`@cosimi/sdk` consumer.

---

## Tier roadmap

| Tier | Mechanism | Status |
|---|---|---|
| 1 | SQL cascade: exact → FTS → trigram | Implemented (Tier-1 handlers) |
| 2 | pgvector nearest-neighbor over pairs | Seams now, impl in SP2 |
| 3 | Semantic chunk index + graph traversal → pair lookup | Seams now, impl in SP2 |

Tier 2 and 3 ship together (shared repository layer + offline pipeline). The full Tier 2/3
implementation reference is in the **SP2 section** below.

---

## Sub-projects & sequencing

```
SP1  SDK extraction
       Carve the constellation, A+ wiring, ports + tier registry, rewrite
       playgrounds/* as SDK consumers, changesets, publish v0.1.0.
       Pure refactor — behavior unchanged; the existing test suite is the safety net.
         │  gate: published + all playgrounds green on the SDK
         ├─────────────────────────────┐
SP2  Tier 2/3 impl              SP3  portf → 8bu.dev
     pgvector + chunk/graph +        new repo, install @cosimi/sdk,
     offline pipeline (own spec).    move portf, bind domain.
```

SP2 and SP3 both unblock after SP1 and are independent of each other. Each gets its own
`spec → plan → implementation` cycle.

---

## SP2 reference — Tier 2 & 3 implementation

> Future-impl detail. Not built in SP1; SP1 lands only the seams (ports, additive migration
> stubs, tier-registry slots).

### Architecture principle — repository pattern

All data access goes through a repository port. No layer (pipeline, runtime, API handler)
touches the database directly. Rationale: Cosimi runs on Neon (serverless Postgres), which
does not support Apache AGE or other graph extensions, so the graph layer is simulated in SQL
today. When Cosimi outgrows the SQL graph simulation, the migration path is self-hosted
Postgres + AGE (or a dedicated graph DB). The port abstraction keeps application code portable
across that migration — only a new adapter is written, not a pipeline/runtime refactor.

> **Adapter portability note.** `PostgresGraphAdapter` and `AgeGraphAdapter` use structurally
> different storage models. Switching adapters requires a **data migration**, not just an env
> change. The abstraction makes *application code* portable — not the data.

### Repository ports

```typescript
interface StorageRepository {
  upload(file: Buffer, key: string, mimeType: string): Promise<void>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}

interface DocumentRepository {
  create(doc: NewDocument): Promise<Document>
  findById(id: string): Promise<Document | null>
  list(): Promise<Document[]>
  delete(id: string): Promise<void>
}

interface ChunkRepository {
  create(chunk: NewChunk): Promise<Chunk>
  createMany(chunks: NewChunk[]): Promise<Chunk[]>
  findById(id: string): Promise<Chunk | null>
  findByDocument(documentId: string): Promise<Chunk[]>
  findNearest(embedding: number[], limit: number): Promise<ScoredChunk[]>
  delete(id: string): Promise<void>
}

interface PairRepository {
  create(pair: NewPair): Promise<Pair>
  createMany(pairs: NewPair[]): Promise<Pair[]>
  findById(id: string): Promise<Pair | null>
  findByStatus(status: AuditStatus): Promise<Pair[]>
  findNearest(embedding: number[], limit: number, status?: AuditStatus): Promise<ScoredPair[]>
  findByChunks(chunkIds: string[], embedding: number[]): Promise<ScoredPair[]>
  update(id: string, patch: Partial<Pair>): Promise<Pair>
  delete(id: string): Promise<void>
}

interface GraphRepository {
  addNode(chunk: Chunk): Promise<void>
  addEdge(fromId: string, toId: string, type: RelationType): Promise<void>
  getParent(chunkId: string): Promise<Chunk | null>
  getChildren(chunkId: string): Promise<Chunk[]>
  getRelated(chunkId: string, maxHops?: number): Promise<Chunk[]>
  deleteNode(chunkId: string): Promise<void>
}

type RelationType = 'PARENT_OF' | 'REFERENCES' | 'ELABORATES' | 'CONTRADICTS'
type AuditStatus = 'pending' | 'pass' | 'fail' | 'rewrite' | 'flagged'
```

### Adapters

| Port | Adapter | Env value | Notes |
|---|---|---|---|
| `StorageRepository` | `LocalStorageAdapter` | `STORAGE_ADAPTER=local` | Dev default, local filesystem |
| `StorageRepository` | `R2StorageAdapter` | `STORAGE_ADAPTER=r2` | Cloudflare R2 via S3 API |
| `GraphRepository` | `PostgresGraphAdapter` | `GRAPH_ADAPTER=postgres` | `chunk_relations` + recursive CTE. Default on Neon. |
| `GraphRepository` | `AgeGraphAdapter` | `GRAPH_ADAPTER=age` | Apache AGE + Cypher. Self-hosted Postgres. |

All other repositories have a single Postgres adapter (Neon-compatible).

### Database schema (Neon + pgvector; `N` = embedding dimension, set once at migration time)

```sql
documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  mime_type    text not null,
  storage_key  text not null,        -- object path in R2/local; raw content never in DB
  created_at   timestamptz default now()
)

chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  content       text not null,
  chunk_index   integer not null,
  section_title text,
  embedding     vector(N),
  created_at    timestamptz default now()
)
create index on chunks using ivfflat (embedding vector_cosine_ops);
create index on chunks (document_id);
-- No parent_id. Hierarchy lives in chunk_relations via GraphRepository.

chunk_relations (                     -- SQL backing table for PostgresGraphAdapter
  from_chunk_id  uuid not null references chunks(id) on delete cascade,
  to_chunk_id    uuid not null references chunks(id) on delete cascade,
  relation_type  text not null,
  created_at     timestamptz default now(),
  primary key (from_chunk_id, to_chunk_id, relation_type)
)
create index on chunk_relations (from_chunk_id);
create index on chunk_relations (to_chunk_id);

pairs (
  id            uuid primary key default gen_random_uuid(),
  question      text not null,
  answer        text not null,
  embedding     vector(N),
  source_chunk  uuid references chunks(id) on delete set null,
  audit_status  text not null default 'pending',
  created_at    timestamptz default now()
)
create index on pairs using ivfflat (embedding vector_cosine_ops);
create index on pairs (audit_status);
create index on pairs (source_chunk);

chunk_pair_map (                      -- used by PairRepository.findByChunks()
  chunk_id  uuid not null references chunks(id) on delete cascade,
  pair_id   uuid not null references pairs(id) on delete cascade,
  primary key (chunk_id, pair_id)
)
```

> Schema note: existing Tier-1 `pairs` is `BIGSERIAL`-keyed with FTS/trigram columns. The
> Tier 2/3 `pairs` shape above is the target end-state; SP2 must reconcile it with the live
> Tier-1 table via additive migration, not a rewrite. SP1 lands the migration *files* gated
> (not applied to live DB).

### Graph layer

- **Vertical links (hierarchy):** created during chunking when a section exceeds 600 tokens
  and is split into children. Both inserted into `chunks`, linked via
  `graphRepo.addEdge(parentId, childId, 'PARENT_OF')`. At runtime, a child-chunk hit resolves
  to its parent for broader context.
- **Horizontal links (cross-references):** created in a dedicated relation-extraction pass
  after all chunks for a document exist. One LLM call receives all chunk contents and
  identifies referencing/elaborating pairs. **Intra-document only**; cross-document linking is
  out of scope.
- **SQL adapter limitations:** recursive-CTE traversal degrades with deep/wide graphs
  (acceptable for shallow intra-doc graphs, <50 chunks/doc); no native graph algorithms;
  bidirectional traversal queries both columns. Migration path = `AgeGraphAdapter`.

### Offline pipeline (async, post-ingestion; no user waiting)

1. **Ingest** — `POST` document (multipart) → `StorageRepository.upload()` →
   `DocumentRepository.create()` → trigger pipeline job async.
2. **Parse & chunk** — `StorageRepository.download()` → detect structure → chunk (below) →
   per chunk `ChunkRepository.create()` + `GraphRepository.addNode()` → per parent→child
   `addEdge(PARENT_OF)`.
3. **Extract relations** — `ChunkRepository.findByDocument()` → one LLM call → per identified
   pair `addEdge(REFERENCES | ELABORATES | CONTRADICTS)`. Skip if <3 chunks.
4. **Generate pairs** — per chunk → strong LLM → 3–5 `{q, a}` → `PairRepository.create()`
   (`audit_status='pending'`) + `chunk_pair_map` insert.
5. **Audit pairs** — `findByStatus('pending')` → per pair, fetch source chunk → audit LLM →
   `pass` / `fail` / `rewrite` (rewrite re-embeds and sets `pass`).
6. **Reverse check (optional)** — `findByStatus('pass')` → generate question from answer →
   embed → if `cosine(generated_q, pair.embedding) < REVERSE_CHECK_THRESHOLD` → `flagged`.

### Chunking strategy

- **A — Structure-aware (preferred):** when headings detected (markdown `##`/`###`, HTML
  `<h2>`/`<h3>`). Each section = one chunk; append first sentence of next section as overlap;
  split sections >600 tokens into children linked `PARENT_OF`; store heading in
  `section_title`.
- **B — Embedding-based (fallback):** plain text/transcripts. Split into sentences → embed →
  split where adjacent cosine `< CHUNK_SPLIT_THRESHOLD` (default `0.55`); merge splits <3
  sentences apart; target 150–400 tokens/chunk.

### System prompts

**Generation (strong model):**
```
System:
You are a Q&A pair generator for a chatbot knowledge base.
Given a source chunk, generate realistic Q&A pairs a user might ask.

Rules:
- Questions must be naturally phrased — informal, as a real user would type them.
- Answers must be fully grounded in the chunk. No external knowledge.
- Vary phrasing: include informal language, typos, short forms, paraphrases.
- Output ONLY a valid JSON array. No preamble, no markdown fences.
- Format: [{ "q": "...", "a": "..." }]
- Generate 3–5 pairs. No more than 5.

User:
<chunk>{{ chunk_text }}</chunk>
```

**Relation extraction (strong model):**
```
System:
You are analyzing chunks from the same document to identify cross-references.
Given a list of numbered chunks, identify pairs that reference, elaborate on,
or contradict each other.

Output ONLY a valid JSON array. No preamble, no markdown fences.
Format: [{ "from": 0, "to": 2, "type": "references" | "elaborates" | "contradicts" }]
If no relationships exist, output an empty array: []

User:
<chunks>
{% for chunk in chunks %}
[{{ loop.index0 }}] {{ chunk.content }}
{% endfor %}
</chunks>
```

**Audit (lightweight local model):**
```
System:
You are a strict QA auditor for a chatbot knowledge base.
Evaluate whether the Q&A pair is accurate and grounded in the source chunk.
Be strict — subtle factual differences (wrong date, wrong qualifier) must be flagged.

Output ONLY a valid JSON object. No preamble, no markdown fences.
Format:
{ "verdict": "pass" | "fail" | "rewrite",
  "reason": "<one sentence>",
  "rewritten_answer": "<corrected answer>" | null }

- pass: answer fully supported, question specific and natural
- fail: answer contains info not in chunk, or question too vague
- rewrite: answer has a subtle inaccuracy — provide rewritten_answer

User:
<chunk>{{ chunk_text }}</chunk>
<pair>
Q: {{ question }}
A: {{ answer }}
</pair>

Check:
1. Is every factual claim directly supported by the chunk?
2. Is the question specific enough that a real user would ask it?
3. Does the answer actually address the question?
```

**Reverse check (lightweight local model):**
```
System:
Given a chatbot answer, generate the most natural question a user would ask to receive it.
Output ONLY the question. Nothing else.

User:
Answer: {{ answer }}
```

### Runtime query flow (Tier 2/3 active; no LLM calls)

```
1. Receive query string
2. Embed query (reuse the vector for all subsequent steps)
3. [Tier 1] SQL cascade (existing): exact → FTS → trigram → hit: reply, tier "1"
4. [Tier 2] PairRepository.findNearest(embedding, 1, status:'pass')
   → cosine >= TIER2_THRESHOLD → hit: reply, tier "2"
5. [Tier 3] ChunkRepository.findNearest(embedding, 1)
   → GraphRepository.getParent() (resolve to parent if any)
   → GraphRepository.getRelated(resolved, maxHops:2)
   → union(resolved, related) → PairRepository.findByChunks(chunkIds, embedding)
   → cosine >= TIER3_THRESHOLD → hit: reply, tier "3"
6. Fallback reply, tier "fallback" → log query for gap analysis
```

`tier` is internal debugging only — strip before exposing to end users.

### SP2 configuration

```
# Adapters
STORAGE_ADAPTER            # "local" | "r2"
GRAPH_ADAPTER              # "postgres" | "age"
# Storage
STORAGE_LOCAL_DIR  STORAGE_BUCKET  STORAGE_ENDPOINT  STORAGE_ACCESS_KEY  STORAGE_SECRET_KEY
# Models
EMBEDDING_MODEL  GENERATION_MODEL  AUDIT_MODEL
# Pipeline
PAIRS_PER_CHUNK=4  AUDIT_REVERSE_CHECK=true  REVERSE_CHECK_THRESHOLD=0.75  CHUNK_SPLIT_THRESHOLD=0.55
# Runtime thresholds
TIER2_THRESHOLD=0.82  TIER3_THRESHOLD=0.72
```

### SP2 open decisions (for the implementing agent)

1. **Embedding model:** VI+EN → `multilingual-e5-large` or
   `paraphrase-multilingual-mpnet-base-v2`; EN-only → `all-MiniLM-L6-v2`.
2. **Vector dimension N:** determined by chosen model; set once in the initial migration.
3. **Job queue:** sequential async is fine for low volume; BullMQ / pg-boss if retries or
   concurrency control are needed.
4. **PDF parsing:** `pdfjs-dist`; detect headings by font size relative to body.
5. **Embedding API batching:** batch + respect rate limits for external APIs; unneeded for
   local models.
6. **Fallback reply:** code/frontend-message driven.

[changesets]: https://github.com/changesets/changesets
