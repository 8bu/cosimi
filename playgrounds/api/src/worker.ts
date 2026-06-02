import { runWithRequestDb } from "@cosimi/adapter-postgres";

import { app } from "./app";
import { sweepOnce } from "./lib/gc";
import { log } from "./lib/logger";
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
interface ScheduledController {
  scheduledTime: number;
  cron: string;
}
interface WorkerEnv {
  HYPERDRIVE?: { connectionString: string };
  [key: string]: unknown;
}

/**
 * Bridge Cloudflare bindings into `process.env` before `loadEnv()` (called
 * lazily by @cosimi/adapter-postgres, @cosimi/matcher, gc) sees them. The Postgres URL is
 * NOT a secret/var - it is provided at runtime by the Hyperdrive binding.
 * Remaining string-valued bindings (LOG_LEVEL, MATCH_*, SSE_DELAY_*, ...) are
 * forwarded verbatim; the Hyperdrive object is skipped (not a string).
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
    // reuse). The scope rides along to Hono's deferred SSE generator via
    // AsyncLocalStorage, so matcher/handler `sql()` calls resolve to it.
    return runWithRequestDb(async () => app.fetch(stripApiPrefix(req)));
  },

  // Replaces the in-process setInterval GC (Workers have no long-lived
  // process). Cron cadence is set in wrangler.toml. waitUntil keeps the
  // isolate alive until the sweep resolves; a throw is caught so the cron
  // run is not marked failed on a transient DB blip.
  async scheduled(
    _controller: ScheduledController,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    hoistEnv(env);
    ctx.waitUntil(
      runWithRequestDb(() =>
        sweepOnce()
          .then(({ sessions, teaches }) => {
            if (sessions + teaches > 0) log.info({ sessions, teaches }, "gc.sweep");
          })
          .catch((err) => {
            log.error({ err }, "gc.sweep.failed");
          }),
      ),
    );
  },
};
