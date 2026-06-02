import type { ChatStreamEvent } from "@cosimi/core";

/**
 * Parse a fetch ReadableStream of SSE bytes into a typed event stream.
 *
 * Wire format produced by apps/api's lib/sse.ts:
 *
 *   data: <JSON ChatStreamEvent>\n\n
 *   data: <JSON ChatStreamEvent>\n\n
 *   ...
 *   data: [DONE]\n\n
 *
 * The `[DONE]` terminator is the OpenAI/Anthropic convention and is
 * written from a `finally` block on the server - it fires even when the
 * generator throws. The structured `{ type: 'done' }` event is for
 * callers that want a typed terminator inside a `switch (event.type)`
 * block; the wire-level terminator is always `[DONE]`. We treat `[DONE]`
 * as a stream-end sentinel (`return` from the generator) and do NOT try
 * to JSON-parse it.
 *
 * Hand-rolled rather than depending on EventSource (GET-only) or a
 * library - the protocol is ~30 LOC and our discriminated-union wire
 * shape is custom anyway. AbortSignal cleanup is the caller's job (pass
 * `signal` to fetch); the `finally` block here releases the reader lock
 * so an aborted stream doesn't leave the response body in a locked state.
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += decoder.decode(value, { stream: true });

      // Drain every complete frame in the buffer. SSE frames are
      // delimited by \n\n; anything past the last \n\n stays in `buf`
      // for the next read iteration (chunk-split-mid-event is normal).
      let sep: number;
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const event = parseSseChunk(frame);
        if (event === "done") return;
        if (event !== null) yield event;
      }
      if (done) break;
    }
    // Tail flush - a well-behaved server always ends with [DONE]\n\n so
    // we hit `return` above and never get here. But if the connection
    // closed mid-frame (network error, server crash) the trailing bytes
    // could be a complete event missing its \n\n terminator. Best-effort
    // parse so the last token isn't silently dropped.
    if (buf.trim()) {
      const event = parseSseChunk(buf);
      if (event && event !== "done") yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseChunk(raw: string): ChatStreamEvent | "done" | null {
  // SSE allows multiple `data:` lines per frame (concatenated with \n).
  // Our server only writes one, but the spec-correct concat is cheap.
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("data:")) data += line.slice(5).trim();
    // `event:` and `:`-comment lines are ignored - the server uses
    // pure-data framing.
  }
  if (!data) return null;
  if (data === "[DONE]") return "done";
  try {
    return JSON.parse(data) as ChatStreamEvent;
  } catch {
    // Malformed JSON - drop the frame rather than poison the stream.
    return null;
  }
}
