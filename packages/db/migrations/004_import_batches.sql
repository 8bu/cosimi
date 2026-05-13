CREATE TABLE import_batches (
  id          BIGSERIAL PRIMARY KEY,
  source      TEXT NOT NULL CHECK (source IN ('seed','llm','user','chat')),
  topic       TEXT,
  count       INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pairs
  ADD CONSTRAINT pairs_batch_fk
  FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE SET NULL;
