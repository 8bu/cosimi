import { createLogger } from "@cosimi/logger";

// Lazy singleton. The worker bridges the Hyperdrive binding into
// `process.env.DATABASE_URL` (see worker.ts `hoistEnv`) only at request/cron
// time, but `createLogger` calls `loadEnv()` which validates the full env
// (incl. DATABASE_URL). Constructing the logger at import time therefore fails
// wrangler's deploy-time startup validation, where no bindings are present.
// Defer construction to first use — by then `hoistEnv` has run. (Mirrors the
// CLAUDE.md rule against `export const env = loadEnv()`.)
let instance: ReturnType<typeof createLogger> | undefined;
function get(): ReturnType<typeof createLogger> {
  return (instance ??= createLogger("api"));
}

export const log = new Proxy({} as ReturnType<typeof createLogger>, {
  get(_target, prop) {
    const value = get()[prop as keyof ReturnType<typeof createLogger>];
    return typeof value === "function" ? value.bind(get()) : value;
  },
});
