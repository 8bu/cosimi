import { sql } from "@cosimi/db";
import type { HealthResponse } from "@cosimi/types";
import { Hono } from "hono";

const startedAt = Date.now();

/**
 * Liveness + DB readiness. 1s timeout on the DB ping so a hung pool
 * doesn't keep the orchestrator's health check hanging — 503 is the
 * correct signal for "I am up but my dependency isn't".
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
      if (typeof timer.unref === "function") timer.unref();
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
  const payload: HealthResponse = {
    ok: dbOk,
    db: dbOk ? "up" : "down",
    db_latency_ms: dbLatencyMs,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
  };
  return c.json(payload, dbOk ? 200 : 503);
});
