import { Hono } from "hono";
import { sql } from "@cosimi/db";
import type { StatsResponse } from "@cosimi/types";

/**
 * Public, no-auth. Drives the chat header's "pairs learned" counter.
 *
 * The query is `count(*)` over `pairs_normalized_unaccented_idx`, a partial
 * index on `deleted_at IS NULL`, so the scan is index-only and resolves in
 * sub-millisecond at the current scale. Add a 10s in-process TTL cache
 * here only if traffic warrants — for now, keep it simple.
 */
export const statsRoute = new Hono();

statsRoute.get("/", async (c) => {
  const rows = await sql()<{ total: number }[]>`
    SELECT count(*)::int AS total FROM pairs WHERE deleted_at IS NULL
  `;
  const payload: StatsResponse = { total_pairs_learned: rows[0]?.total ?? 0 };
  return c.json(payload);
});
