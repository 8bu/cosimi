import { sql } from "@cosimi/adapter-postgres";
import type { IngestProgress } from "@cosimi/sdk/offline";

/**
 * Durable status/progress store for async document ingest (ingest_jobs table).
 *
 * The job is the source of truth the lab polls. Execution stays in-process in
 * admin-api (the Anthropic key lives only in the running job's memory closure
 * and is NEVER written here), so a row is bound to the process that created it —
 * `sweepRunning()` runs on boot to mark any leftover `running` rows as `error`,
 * since in-memory work cannot survive a restart.
 */

export interface IngestJob {
  id: string;
  title: string;
  status: "running" | "done" | "error";
  stage: string;
  chunksTotal: number;
  chunksDone: number;
  pairsGenerated: number;
  pairsAudited: number;
  pairsPassed: number;
  documentId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createJob(title: string): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    INSERT INTO ingest_jobs (title) VALUES (${title}) RETURNING id
  `;
  return row!.id;
}

/** Mirror a pipeline progress tick onto the row. Best-effort; never throws upstream. */
export async function writeProgress(id: string, p: IngestProgress): Promise<void> {
  await sql()`
    UPDATE ingest_jobs SET
      stage           = ${p.stage},
      chunks_total    = ${p.chunksTotal},
      chunks_done     = ${p.chunksDone},
      pairs_generated = ${p.pairsGenerated},
      pairs_audited   = ${p.pairsAudited},
      pairs_passed    = ${p.pairsPassed},
      updated_at      = now()
    WHERE id = ${id}
  `;
}

export async function finishJob(id: string, documentId: string, passed: number): Promise<void> {
  await sql()`
    UPDATE ingest_jobs SET
      status = 'done', stage = 'done', document_id = ${documentId},
      pairs_passed = ${passed}, updated_at = now()
    WHERE id = ${id}
  `;
}

export async function failJob(id: string, message: string): Promise<void> {
  await sql()`
    UPDATE ingest_jobs SET status = 'error', error = ${message}, updated_at = now()
    WHERE id = ${id}
  `;
}

// snake_case columns → camelCase DTO. Inlined in both readers (no module-level
// sql() call, and postgres.js tagged templates aren't composable as fragments here).
export async function getJob(id: string): Promise<IngestJob | null> {
  const [row] = await sql()<IngestJob[]>`
    SELECT id, title, status, stage,
      chunks_total AS "chunksTotal", chunks_done AS "chunksDone",
      pairs_generated AS "pairsGenerated", pairs_audited AS "pairsAudited",
      pairs_passed AS "pairsPassed", document_id AS "documentId", error,
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM ingest_jobs WHERE id = ${id}
  `;
  return row ?? null;
}

export async function listJobs(limit = 20): Promise<IngestJob[]> {
  return sql()<IngestJob[]>`
    SELECT id, title, status, stage,
      chunks_total AS "chunksTotal", chunks_done AS "chunksDone",
      pairs_generated AS "pairsGenerated", pairs_audited AS "pairsAudited",
      pairs_passed AS "pairsPassed", document_id AS "documentId", error,
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM ingest_jobs ORDER BY created_at DESC LIMIT ${limit}
  `;
}

/** Boot recovery: in-memory jobs can't survive a restart — fail any left `running`. */
export async function sweepRunning(): Promise<number> {
  const rows = await sql()<{ id: string }[]>`
    UPDATE ingest_jobs
       SET status = 'error', error = 'interrupted by admin-api restart', updated_at = now()
     WHERE status = 'running'
    RETURNING id
  `;
  return rows.length;
}
