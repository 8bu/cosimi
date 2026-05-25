import { Hono } from "hono";
import * as v from "valibot";

import { withSession } from "../lib/session";
import { streamChat } from "../lib/sse";
import { runChat } from "../services/chat-handler";

// Phase 11.1 widens the body shape: `locales` (ordered preference for the
// matcher cascade) and `locale` (the locale of any /teach in this turn).
// Both are bounded BCP-47-ish strings — we don't validate the tag's
// internal structure (the matcher tolerates unknown locales by falling
// through to 'und'-tagged rows), only that the strings are sane.
const LocaleString = v.pipe(v.string(), v.nonEmpty(), v.maxLength(16));

const ChatBodySchema = v.object({
  message: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000)),
  // Already consumed by withSession; declared here so the schema accepts it.
  session_id: v.optional(v.pipe(v.string(), v.uuid())),
  locales: v.optional(v.pipe(v.array(LocaleString), v.maxLength(8))),
  locale: v.optional(LocaleString),
});

export const chatRoute = new Hono();

chatRoute.post("/", withSession, (c) => {
  const body = c.get("parsedBody");
  const parsed = v.safeParse(ChatBodySchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  const sessionId = c.get("sessionId");
  const { message, locales, locale } = parsed.output;
  return streamChat(c, (emit) => runChat({ sessionId, message, locales, locale, emit }));
});
