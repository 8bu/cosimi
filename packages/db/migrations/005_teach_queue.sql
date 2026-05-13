CREATE TABLE teach_queue (
  id                    BIGSERIAL PRIMARY KEY,
  input                 TEXT NOT NULL,
  normalized_input      TEXT NOT NULL,
  response              TEXT NOT NULL,
  topic                 TEXT,
  submitted_by_session  UUID NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  flagged               BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason           TEXT,
  reviewed_at           TIMESTAMPTZ,
  reviewer_note         TEXT,
  pair_id               BIGINT REFERENCES pairs(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX teach_queue_status_idx  ON teach_queue (status, created_at);
CREATE INDEX teach_queue_session_idx ON teach_queue (submitted_by_session, created_at DESC);
CREATE INDEX teach_queue_flagged_idx ON teach_queue (flagged) WHERE flagged = TRUE;
