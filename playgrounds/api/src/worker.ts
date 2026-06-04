import { runWithRequestDb } from "@cosimi/adapter-postgres";

import { app } from "./app";
import { runWithAi } from "./lib/embedder";
import type { AiBinding } from "@cosimi/adapter-embed-workers-ai";
import { stripApiPrefix } from "./lib/worker-url";

/**
 * Minimal Cloudflare Workers ambient types. Defined inline (rather than via
 * `@cloudflare/workers-types`) so the shared `tsc --noEmit` typecheck stays
 * scoped to @types/node globals. wrangler bundles via esbuild and does not
 * typecheck, so these are only for our own editor/CI typecheck.
 */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
interface WorkerEnv {
  HYPERDRIVE?: { connectionString: string };
  AI?: AiBinding;
  [key: string]: unknown;
}

/**
 * Bridge Cloudflare bindings into `process.env` before `loadEnv()` (called
 * lazily by @cosimi/adapter-postgres + @cosimi/retriever) sees them. The Postgres
 * URL is NOT a secret/var - it is provided at runtime by the Hyperdrive binding.
 * Remaining string-valued bindings (LOG_LEVEL, RETRIEVE_*, ...) are forwarded
 * verbatim; the Hyperdrive object is skipped (not a string).
 */
function hoistEnv(env: WorkerEnv): void {
  if (env.HYPERDRIVE?.connectionString) {
    process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
  }
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") process.env[key] = value;
  }
}

export default {
  async fetch(req: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    hoistEnv(env);
    // app.fetch's env/ctx args are omitted: the Hono routes read config from
    // process.env (hoisted above), not from c.env, and reference no
    // c.executionCtx. Passing our minimal inline ExecutionContext would fail
    // typecheck against Hono's (which now requires a `props` field).
    //
    // runWithRequestDb installs a request-scoped postgres client so the pool
    // is never shared across requests (workerd forbids cross-request socket
    // reuse). The scope rides along via AsyncLocalStorage so `sql()` calls in
    // the retrieve handler resolve to it.
    return runWithRequestDb(async () => {
      const run = () => app.fetch(stripApiPrefix(req));
      return env.AI ? runWithAi(env.AI, run) : run();
    });
  },
};
