CREATE TABLE unanswered (
  id                BIGSERIAL PRIMARY KEY,
  input             TEXT NOT NULL,
  normalized_input  TEXT NOT NULL UNIQUE,
  source            TEXT NOT NULL DEFAULT 'chat' CHECK (source IN ('chat','llm')),
  count             INTEGER NOT NULL DEFAULT 1,
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX unanswered_count_idx  ON unanswered (count DESC, last_seen DESC);
CREATE INDEX unanswered_source_idx ON unanswered (source, count DESC);
