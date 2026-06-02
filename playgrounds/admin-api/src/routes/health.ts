import { sql } from "@cosimi/adapter-postgres";
import { Hono } from "hono";

const startedAt = Date.now();

/**
 * Liveness + DB readiness for the admin process. Mirrors the public api's
 * `/healthz`: 1s budget on the DB ping so a hung pool doesn't keep the
 * orchestrator's health check hanging.
 *
 * The timeout's setTimeout is .unref()'d so an in-flight ping during
 * SIGINT/SIGTERM shutdown doesn't keep the event loop alive past
 * server.close().
 */
export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  const t0 = performance.now();
  try {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error("db ping timeout")), 1000);
      timer.unref();
    });
    try {
      await Promise.race([sql()`SELECT 1`, timeout]);
      dbOk = true;
      dbLatencyMs = Math.round(performance.now() - t0);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    dbOk = false;
  }
  return c.json(
    {
      ok: dbOk,
      db: dbOk ? "up" : "down",
      db_latency_ms: dbLatencyMs,
      uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    },
    dbOk ? 200 : 503,
  );
});
