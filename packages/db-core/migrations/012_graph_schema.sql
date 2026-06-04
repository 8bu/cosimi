-- ════════════════════════════════════════════════════════════════════════
-- GRAPH / VECTOR RETRIEVAL SCHEMA
-- ════════════════════════════════════════════════════════════════════════
-- The retrieval substrate: documents, chunks (pgvector embeddings), the chunk
-- relation graph, and the vector columns on `pairs`. This is the SDK's core —
-- retrieve() reads it — so it ships in the default migration sequence. Every
-- target needs the `vector` extension (Neon, the dev container, and the test
-- image all have it). Additive: it ALTERs the existing `pairs` table rather
-- than replacing it. Embedding dimension is 1024 (bge-m3).
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── documents: metadata only; raw content lives in object storage ──────────
CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  mime_type    text NOT NULL,
  storage_key  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── chunks: semantic units derived from documents ──────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content       text NOT NULL,
  chunk_index   integer NOT NULL,
  section_title text,
  embedding     vector(1024),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks (document_id);

-- ─── chunk_relations: SQL backing for PostgresGraphAdapter ──────────────────
CREATE TABLE IF NOT EXISTS chunk_relations (
  from_chunk_id  uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  to_chunk_id    uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  relation_type  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_chunk_id, to_chunk_id, relation_type)
);
CREATE INDEX IF NOT EXISTS chunk_relations_from_idx ON chunk_relations (from_chunk_id);
CREATE INDEX IF NOT EXISTS chunk_relations_to_idx ON chunk_relations (to_chunk_id);

-- ─── pairs: additive embedding/audit columns on the existing table ──────────
-- The `pairs` table is BIGSERIAL-keyed with FTS/trigram columns; this migration
-- extends it rather than replacing it (see docs/ARCHITECTURE.md "Data model").
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS embedding    vector(1024);
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'pass';
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS source_chunk uuid REFERENCES chunks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pairs_embedding_idx ON pairs USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS pairs_audit_status_idx ON pairs (audit_status);
CREATE INDEX IF NOT EXISTS pairs_source_chunk_idx ON pairs (source_chunk);

-- ─── chunk_pair_map: used by PairRepository.findByChunks() (graph walk) ─────
CREATE TABLE IF NOT EXISTS chunk_pair_map (
  chunk_id  uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  pair_id   bigint NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  PRIMARY KEY (chunk_id, pair_id)
);
