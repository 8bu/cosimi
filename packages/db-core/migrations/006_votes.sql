CREATE TABLE votes (
  session_id  UUID NOT NULL,
  pair_id     BIGINT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  value       SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, pair_id)
);
CREATE INDEX votes_pair_idx ON votes (pair_id);
