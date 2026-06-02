import { AsyncLocalStorage } from "node:async_hooks";

import postgres from "postgres";
import { loadEnv } from "@cosimi/config";

type Sql = ReturnType<typeof postgres>;

// Long-lived process (apps/api dev/prod, admin-api, vitest) reuses one pool.
let instance: Sql | null = null;

// Cloudflare Workers: a connection's socket is an I/O object bound to the
// request that opened it. Reusing it from a later request's isolate throws
// "Cannot perform I/O on behalf of a different request". `runWithRequestDb`
// installs a fresh, request-scoped client here so each request gets its own.
const requestScope = new AsyncLocalStorage<Sql>();

function createClient(max: number, idleTimeout: number): Sql {
  const env = loadEnv();
  return postgres(env.DATABASE_URL, {
    max,
    idle_timeout: idleTimeout,
    transform: { undefined: null },
    onnotice: () => {},
  });
}

/**
 * The active postgres client. Prefers a request-scoped client (Workers, set by
 * `runWithRequestDb`); otherwise the process-level singleton (Node).
 */
export function sql(): Sql {
  return requestScope.getStore() ?? (instance ??= createClient(10, 30));
}

/**
 * Run `fn` with a fresh, request-scoped postgres client and return its result.
 *
 * Used by the Worker fetch/scheduled handlers so module state never leaks a
 * socket across requests. The client is deliberately NOT closed here: a
 * streaming SSE response keeps using it after `app.fetch()` resolves (Hono runs
 * the stream generator in the background), so an explicit `end()` would race the
 * still-running handler. postgres.js reaps the socket via `idle_timeout` once
 * the request's DB work is done; Hyperdrive bounds the upstream pool.
 */
export function runWithRequestDb<T>(fn: () => Promise<T>): Promise<T> {
  return requestScope.run(createClient(3, 5), fn);
}

export async function closeDb() {
  if (instance) {
    await instance.end();
    instance = null;
  }
}
