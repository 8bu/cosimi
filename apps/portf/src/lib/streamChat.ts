import type { ChatRequest, ChatStreamEvent } from "@simlm/types";
import { apiBase } from "@/lib/apiBase";
import { parseSseStream } from "@/lib/sse-parser";
import { usePreferencesStore } from "@/store/preferences";
import { useSessionsStore } from "@/store/sessions";

/**
 * Open a streaming /chat request scoped to `threadId`.
 *
 * Server-canonical session id (CLAUDE.md): if `sessions.get(threadId)` is
 * undefined, this call sends NO `X-Session-Id` header - the server mints
 * and returns the id in the response header, which we adopt before
 * yielding the first event. Subsequent calls for the same thread send
 * the cached header back.
 *
 * The generator yields parsed events from `parseSseStream`. The caller
 * (messages-store `send`) owns the AbortController; this function
 * forwards `signal` to fetch so an aborted request tears down cleanly.
 *
 * `locales: [primary, 'und']` mirrors apps/web's per-turn locale read:
 * imperative at call time, not via React reactivity (the generator runs
 * outside the render tree). `locale: primary` rides along even though
 * portf doesn't expose /teach - the server's per-pair locale stamping
 * is still useful diagnostically.
 */
export async function* streamChatPortf(
  threadId: string,
  text: string,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const primary = usePreferencesStore.getState().primaryLocale;
  const cachedSession = useSessionsStore.getState().get(threadId);

  const body: ChatRequest = {
    message: text,
    locales: [primary, "und"],
    locale: primary,
  };

  const res = await fetch(`${apiBase()}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cachedSession ? { "X-Session-Id": cachedSession } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`chat stream failed: ${res.status} ${res.statusText}`);
  }

  const serverSession = res.headers.get("X-Session-Id");
  if (serverSession) useSessionsStore.getState().set(threadId, serverSession);

  yield* parseSseStream(res.body);
}
