import type { ChatRequest, ChatStreamEvent } from "@cosimi/core";

import { parseSseStream } from "@/lib/sse-parser";
import { preferencesStore } from "@/store/preferences";

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
 *
 * Phase 11.1: reads the current primary locale from preferencesStore at
 * call time (imperative, mirrors apiFetch's session-id read pattern) and
 * stuffs `locales: [primary, 'und']` into the body. The fallback to 'und'
 * inside each tier means a Vi-primary user still sees universal-tagged
 * pairs when no Vi-tagged pair matches. `locale: primary` rides along so
 * any /teach in this turn gets stamped with the same primary locale.
 */
export async function* streamChat(
  req: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const primary = preferencesStore.getState().primaryLocale;
  const reqWithLocale: ChatRequest = {
    ...req,
    locales: req.locales ?? [primary, "und"],
    locale: req.locale ?? primary,
  };
  const res = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(reqWithLocale),
    signal,
    raw: true,
  });
  if (!res.ok || !res.body) {
    throw new Error(`chat stream failed: ${res.status} ${res.statusText}`);
  }
  yield* parseSseStream(res.body);
}
