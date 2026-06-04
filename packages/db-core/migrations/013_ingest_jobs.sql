-- ════════════════════════════════════════════════════════════════════════
-- ingest_jobs: durable status/progress for async document ingest.
-- ════════════════════════════════════════════════════════════════════════
-- POST /ingest now returns immediately with a job id; the pipeline runs detached
-- in the admin-api process and reports progress here. This table is the source
-- of truth the lab polls. Execution stays IN-PROCESS (the Anthropic key lives
-- only in the job's memory closure and is NEVER persisted), so a row is bound to
-- the process that created it — admin-api boot sweeps any leftover `running`
-- rows to `error` (in-memory work cannot survive a restart).
--
-- `document_id` has no FK: a job is history and outlives the document it produced
-- (deleting the document must not erase the ingest record). Additive, IF NOT
-- EXISTS — safe to re-run.

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  status           text NOT NULL DEFAULT 'running', -- running | done | error
  stage            text NOT NULL DEFAULT 'starting', -- starting|chunking|generating|auditing|done
  chunks_total     integer NOT NULL DEFAULT 0,
  chunks_done      integer NOT NULL DEFAULT 0,
  pairs_generated  integer NOT NULL DEFAULT 0,
  pairs_audited    integer NOT NULL DEFAULT 0,
  pairs_passed     integer NOT NULL DEFAULT 0,
  document_id      uuid,                            -- set on success; no FK (job is history)
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingest_jobs_status_idx ON ingest_jobs (status);
CREATE INDEX IF NOT EXISTS ingest_jobs_created_idx ON ingest_jobs (created_at DESC);
