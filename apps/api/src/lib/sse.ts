import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { ChatStreamEvent } from "@cosimi/types";

import { log } from "./logger";

export type Emitter = (e: ChatStreamEvent) => Promise<void>;

/**
 * Wrap an async generator function in a Hono SSE response.
 *
 * Each ChatStreamEvent is JSON-encoded into the `data:` line of one SSE
 * frame. A terminator frame with literal `[DONE]` is always written in
 * the `finally` block — the OpenAI/Anthropic convention — so well-behaved
 * clients can stop reading without waiting for the connection to close.
 *
 * Errors thrown by `generate` are swallowed here: a generic `error` event
 * is emitted to the client (no stack trace), and the redacted pino logger
 * carries the diagnostic detail.
 */
export function streamChat(c: Context, generate: (emit: Emitter) => Promise<void>): Response {
  return streamSSE(c, async (stream) => {
    const emit: Emitter = async (e) => {
      await stream.writeSSE({ data: JSON.stringify(e) });
    };
    try {
      await generate(emit);
    } catch (err) {
      log.error({ err: serializeErr(err) }, "sse handler failed");
      try {
        await emit({ type: "error", message: "internal error" });
      } catch {
        // socket already gone — nothing we can do
      }
    } finally {
      try {
        await stream.writeSSE({ data: "[DONE]" });
      } catch {
        // socket already gone — nothing we can do
      }
    }
  });
}

function serializeErr(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  return { message: String(err) };
}
