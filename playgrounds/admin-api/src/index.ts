import { serve } from "@hono/node-server";
import { loadEnv } from "@cosimi/core";

import { app } from "./app";
import { log } from "./lib/logger";

const env = loadEnv();

const server = serve(
  { fetch: app.fetch, hostname: env.ADMIN_HOST, port: env.ADMIN_PORT },
  (info) => {
    const isLoopback =
      env.ADMIN_HOST === "127.0.0.1" || env.ADMIN_HOST === "localhost" || env.ADMIN_HOST === "::1";
    if (isLoopback) {
      log.info({ host: env.ADMIN_HOST, port: info.port }, "admin-api listening");
    } else {
      // Soft breadcrumb (not a hard refusal): the user may deliberately want
      // a non-loopback bind behind a Tailscale/Cloudflare/VPN gate. Phase 6
      // spec calls this out explicitly.
      log.warn(
        { host: env.ADMIN_HOST, port: info.port },
        "admin-api is binding to a non-loopback interface — ensure a network-layer gate is in place",
      );
    }
  },
);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
