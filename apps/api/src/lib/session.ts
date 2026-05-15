import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import * as v from "valibot";

const UuidSchema = v.pipe(v.string(), v.uuid());

/**
 * Resolve session_id from (body.session_id ?? X-Session-Id header) or
 * mint a fresh UUID. Always sets the X-Session-Id response header so the
 * client can persist the assignment.
 *
 * Body is parsed *once* here and stashed under c.get('parsedBody') —
 * Hono's c.req.json() is single-call, so route handlers must read the
 * cached copy instead of re-parsing the body stream.
 *
 *   c.get('sessionId')  → string  (UUID v4 or whatever the client supplied)
 *   c.get('parsedBody') → unknown (the JSON body, or null if not JSON)
 */
export const withSession: MiddlewareHandler = async (c, next) => {
  let raw: string | undefined;
  let parsedBody: unknown = null;

  const ctype = c.req.header("content-type") ?? "";
  if (c.req.method === "POST" && ctype.includes("application/json")) {
    parsedBody = await c.req.json().catch(() => null);
    if (parsedBody && typeof parsedBody === "object" && "session_id" in parsedBody) {
      const candidate = (parsedBody as { session_id?: unknown }).session_id;
      if (typeof candidate === "string") raw = candidate;
    }
  }
  c.set("parsedBody", parsedBody);

  if (!raw) raw = c.req.header("x-session-id") ?? undefined;

  const sessionId = raw && v.safeParse(UuidSchema, raw).success ? raw : randomUUID();

  c.set("sessionId", sessionId);
  c.header("X-Session-Id", sessionId);

  await next();
};

declare module "hono" {
  interface ContextVariableMap {
    sessionId: string;
    parsedBody: unknown;
  }
}
