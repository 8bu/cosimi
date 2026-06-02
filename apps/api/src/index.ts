import { serve } from "@hono/node-server";
import { loadEnv } from "@cosimi/core";

import { app } from "./app";
import { startGc, stopGc } from "./lib/gc";
import { log } from "./lib/logger";

const env = loadEnv();

// Bind on 0.0.0.0 so the public chat API is reachable from outside the
// container. The admin API (apps/admin-api, Phase 6) is the loopback-only
// counterpart — keeping them in separate processes is the security boundary.
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" }, (info) => {
  log.info({ port: info.port, hostname: "0.0.0.0" }, "api listening");
});

// GC runs in-process (no separate worker). startGc()'s setInterval is
// .unref()'d so it never blocks process exit; stopGc() is the orderly path
// invoked from SIGINT/SIGTERM below.
startGc();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopGc();
    server.close(() => process.exit(0));
  });
}
