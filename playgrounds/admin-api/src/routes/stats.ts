import { Hono } from "hono";
import { sql } from "@cosimi/adapter-postgres";

/**
 * Admin counters for the dashboard. All totals come back in one round-trip via
 * subqueries; each hits a partial index (`deleted_at IS NULL`, etc.) so the cost
 * is sub-millisecond at realistic scales.
 */
export const statsRoute = new Hono();

statsRoute.get("/", async (c) => {
  const rows = await sql()<
    {
      total_active: number;
      total_deleted: number;
      total_unanswered: number;
    }[]
  >`
    SELECT
      (SELECT count(*) FROM pairs WHERE deleted_at IS NULL)::int     AS total_active,
      (SELECT count(*) FROM pairs WHERE deleted_at IS NOT NULL)::int AS total_deleted,
      (SELECT count(*) FROM unanswered)::int                          AS total_unanswered
  `;
  return c.json(rows[0]!);
});
