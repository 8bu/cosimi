CREATE TABLE sessions (
  session_id              UUID PRIMARY KEY,
  last_input              TEXT,
  last_input_normalized   TEXT,
  last_pair_id            BIGINT REFERENCES pairs(id) ON DELETE SET NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
