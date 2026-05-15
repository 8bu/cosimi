import { serve } from "@hono/node-server";
import { loadEnv } from "@simlm/config";

import { app } from "./app";
import { log } from "./lib/logger";

const env = loadEnv();

// Bind on 0.0.0.0 so the public chat API is reachable from outside the
// container. The admin API (apps/admin-api, Phase 6) is the loopback-only
// counterpart — keeping them in separate processes is the security boundary.
serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" }, (info) => {
  log.info({ port: info.port, hostname: "0.0.0.0" }, "api listening");
});
