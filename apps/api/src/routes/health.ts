import { Hono } from "hono";
import { sql } from "@simlm/db";

const startedAt = Date.now();

/**
 * Liveness + DB readiness. 1s timeout on the DB ping so a hung pool
 * doesn't keep the orchestrator's health check hanging — 503 is the
 * correct signal for "I am up but my dependency isn't".
 */
export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  let dbOk = false;
  try {
    await Promise.race([
      sql()`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error("db ping timeout")), 1000)),
    ]);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return c.json(
    {
      ok: dbOk,
      db: dbOk ? "up" : "down",
      uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    },
    dbOk ? 200 : 503,
  );
});
