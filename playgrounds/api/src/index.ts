import { serve } from "@hono/node-server";
import { loadEnv } from "@cosimi/core";

import { app } from "./app";
import { log } from "./lib/logger";

const env = loadEnv();

// Bind on 0.0.0.0 so the public retrieve API is reachable from outside the
// container. The admin API (playgrounds/admin-api) is the loopback-only
// counterpart — keeping them in separate processes is the security boundary.
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" }, (info) => {
  log.info({ port: info.port, hostname: "0.0.0.0" }, "api listening");
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
