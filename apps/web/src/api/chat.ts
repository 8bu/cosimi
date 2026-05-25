import type { ChatRequest, ChatStreamEvent } from "@simlm/types";

import { parseSseStream } from "@/lib/sse-parser";

import { apiFetch } from "./client";

/**
 * Open a streaming /chat request. Yields typed events until the server
 * writes the `[DONE]` sentinel (or the underlying connection closes).
 *
 * Usage:
 *   for await (const e of streamChat({ message: 'xin chào' }, ac.signal)) {
 *     switch (e.type) { ... }
 *   }
 *
 * `raw: true` on apiFetch is load-bearing: (1) the response body must
 * stay un-consumed for parseSseStream to read it; (2) on a 4xx/5xx the
 * caller of streamChat decides what to do (and gets the status via the
 * thrown error here), instead of apiFetch consuming the body to build
 * an ApiError.
 */
export async function* streamChat(
  req: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const res = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(req),
    signal,
    raw: true,
  });
  if (!res.ok || !res.body) {
    throw new Error(`chat stream failed: ${res.status} ${res.statusText}`);
  }
  yield* parseSseStream(res.body);
}
