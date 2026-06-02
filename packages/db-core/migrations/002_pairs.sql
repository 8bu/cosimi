CREATE TABLE pairs (
  id                     BIGSERIAL PRIMARY KEY,
  input                  TEXT NOT NULL,
  normalized_input       TEXT NOT NULL,
  -- f_unaccent of normalized_input, materialized once at write time
  normalized_unaccented  TEXT GENERATED ALWAYS AS (f_unaccent(normalized_input)) STORED,
  response               TEXT NOT NULL,
  score                  INTEGER NOT NULL DEFAULT 0,
  source                 TEXT NOT NULL CHECK (source IN ('seed','user','chat','llm')),
  topic                  TEXT,
  batch_id               BIGINT,
  flagged                BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- All matching indexes target the unaccented form
CREATE INDEX pairs_normalized_unaccented_idx
  ON pairs (normalized_unaccented) WHERE deleted_at IS NULL;

CREATE INDEX pairs_fts_idx
  ON pairs USING GIN (to_tsvector('simple', normalized_unaccented))
  WHERE deleted_at IS NULL;

CREATE INDEX pairs_trgm_idx
  ON pairs USING GIST (normalized_unaccented gist_trgm_ops)
  WHERE deleted_at IS NULL;

-- Admin / filter / score indexes
CREATE INDEX pairs_source_idx  ON pairs (source) WHERE deleted_at IS NULL;
CREATE INDEX pairs_topic_idx   ON pairs (topic)  WHERE topic IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX pairs_batch_idx   ON pairs (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX pairs_score_idx   ON pairs (score DESC) WHERE deleted_at IS NULL;
CREATE INDEX pairs_flagged_idx ON pairs (flagged) WHERE flagged = TRUE;
