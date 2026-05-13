CREATE TABLE session_teaches (
  id                BIGSERIAL PRIMARY KEY,
  session_id        UUID NOT NULL,
  normalized_input  TEXT NOT NULL,
  response          TEXT NOT NULL,
  teach_queue_id    BIGINT NOT NULL REFERENCES teach_queue(id) ON DELETE CASCADE,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX session_teaches_lookup_idx  ON session_teaches (session_id, normalized_input);
CREATE INDEX session_teaches_expires_idx ON session_teaches (expires_at);
