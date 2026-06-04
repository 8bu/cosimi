import { sql } from "@cosimi/adapter-postgres";
import { createCosimi } from "@cosimi/sdk";
import { Hono } from "hono";

import { resolveEmbedder } from "../lib/embedder";

/**
 * Liveness + GraphRAG schema readiness via the SDK's healthcheck(). Shape:
 * `{ ok, db: 'up'|'down', schema: 'ready'|'absent', issues: string[] }`.
 * 200 when ok, 503 otherwise — the orchestrator's "up but dependency down"
 * signal. healthcheck() never throws on a not-ready DB.
 */
export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  const cosimi = createCosimi({ sql, embedder: resolveEmbedder() });
  const report = await cosimi.healthcheck();
  return c.json(report, report.ok ? 200 : 503);
});
