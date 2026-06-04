import { Hono } from "hono";

import { statsRoute } from "./routes/stats";
import { healthRoute } from "./routes/health";
import { retrieveRoute } from "./routes/retrieve";

export const app = new Hono();

app.route("/stats", statsRoute);
app.route("/healthz", healthRoute);
app.route("/retrieve", retrieveRoute);

app.notFound((c) => c.json({ error: "not found" }, 404));
