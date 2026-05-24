import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";

import { healthRoute } from "./routes/health";
import { importRoute } from "./routes/import";
import { pairsRoute } from "./routes/pairs";
import { rollbackRoute } from "./routes/rollback";
import { statsRoute } from "./routes/stats";
import { teachQueueRoute } from "./routes/teach-queue";
import { unansweredRoute } from "./routes/unanswered";

/**
 * Admin API composition. No `/admin/*` prefix — the entire process is the
 * admin surface (see Phase 6 spec). Security is a deployment property,
 * not a per-route concern: this app's index.ts binds to `127.0.0.1`.
 */
export const app = new Hono();

app.use("*", honoLogger());

app.route("/unanswered", unansweredRoute);
app.route("/pairs", pairsRoute);
app.route("/teach-queue", teachQueueRoute);
app.route("/import", importRoute);
app.route("/rollback", rollbackRoute);
app.route("/stats", statsRoute);
app.route("/healthz", healthRoute);

app.notFound((c) => c.json({ error: "not found" }, 404));
