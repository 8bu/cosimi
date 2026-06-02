-- ════════════════════════════════════════════════════════════════════════
-- TIER 2/3 SEAM MIGRATION — NOT APPLIED IN SP1
-- ════════════════════════════════════════════════════════════════════════
-- This file lives in migrations/tier23/ (a subdirectory), so the default
-- migration runner — which globs only top-level *.sql via listMigrationFiles()
-- — never picks it up. The same exclusion protects the vitest global-setups'
-- applyMigrations(): test/dev Postgres images have pg_trgm (migration 001) but
-- NOT pgvector, so an accidental `CREATE EXTENSION vector` here would break the
-- whole suite. SP2 adds a dedicated runner (gated, e.g. COSIMI_TIER23=1) that
-- targets this directory once a pgvector-capable Postgres is provisioned.
--
-- Schema source of truth: docs/NEW_ARCHITECTURE.md "SP2 reference". Additive
-- only — it ALTERs the existing Tier-1 `pairs` table rather than replacing it.
--
-- N (vector dimension) is a placeholder; SP2 sets it to the chosen embedding
-- model's dimension (e.g. 1024 for multilingual-e5-large) in the real migration.
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
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops);
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

-- ─── pairs: additive Tier 2/3 columns on the existing Tier-1 table ──────────
-- The Tier-1 `pairs` table is BIGSERIAL-keyed with FTS/trigram columns; SP2
-- extends it rather than replacing it (see NEW_ARCHITECTURE schema note).
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS embedding    vector(1024);
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'pass';
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS source_chunk uuid REFERENCES chunks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pairs_embedding_idx ON pairs USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS pairs_audit_status_idx ON pairs (audit_status);
CREATE INDEX IF NOT EXISTS pairs_source_chunk_idx ON pairs (source_chunk);

-- ─── chunk_pair_map: used by PairRepository.findByChunks() (Tier 3) ─────────
CREATE TABLE IF NOT EXISTS chunk_pair_map (
  chunk_id  uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  pair_id   bigint NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  PRIMARY KEY (chunk_id, pair_id)
);
