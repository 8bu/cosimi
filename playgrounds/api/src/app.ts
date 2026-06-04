import { Hono } from "hono";

import { chatRoute } from "./routes/chat";
import { feedbackRoute } from "./routes/feedback";
import { statsRoute } from "./routes/stats";
import { healthRoute } from "./routes/health";
import { retrieveRoute } from "./routes/retrieve";

export const app = new Hono();

app.route("/chat", chatRoute);
app.route("/feedback", feedbackRoute);
app.route("/stats", statsRoute);
app.route("/healthz", healthRoute);
app.route("/retrieve", retrieveRoute);

app.notFound((c) => c.json({ error: "not found" }, 404));
