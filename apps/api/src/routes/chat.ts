import { Hono } from "hono";
import * as v from "valibot";

import { withSession } from "../lib/session";
import { streamChat } from "../lib/sse";
import { runChat } from "../services/chat-handler";

const ChatBodySchema = v.object({
  message: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000)),
  // Already consumed by withSession; declared here so the schema accepts it.
  session_id: v.optional(v.pipe(v.string(), v.uuid())),
});

export const chatRoute = new Hono();

chatRoute.post("/", withSession, (c) => {
  const body = c.get("parsedBody");
  const parsed = v.safeParse(ChatBodySchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  const sessionId = c.get("sessionId");
  const { message } = parsed.output;
  return streamChat(c, (emit) => runChat({ sessionId, message, emit }));
});
