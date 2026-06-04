import { Hono } from "hono";
import { sql } from "@cosimi/adapter-postgres";
import type { StatsResponse } from "@cosimi/core";

/**
 * Public, no-auth corpus size counters (documents, chunks, embedded active
 * pairs). Three index-friendly counts; add a short TTL cache only if traffic
 * warrants.
 */
export const statsRoute = new Hono();

statsRoute.get("/", async (c) => {
  const [row] = await sql()<StatsResponse[]>`
    SELECT
      (SELECT count(*)::int FROM documents) AS documents,
      (SELECT count(*)::int FROM chunks)    AS chunks,
      (SELECT count(*)::int FROM pairs WHERE deleted_at IS NULL AND embedding IS NOT NULL) AS pairs
  `;
  const payload: StatsResponse = row ?? { documents: 0, chunks: 0, pairs: 0 };
  return c.json(payload);
});
