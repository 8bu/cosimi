/**
 * Per-thread `AbortController` registry.
 *
 * Module-level singleton - deliberately outside zustand. Storing
 * AbortController in zustand state would defeat shallow equality on every
 * send() and force unrelated re-renders.
 *
 * Lifecycle:
 *   - `messagesStore.send(threadId, …)` calls `getOrCreateAbort(threadId)`
 *     at the top and `clearAbort(threadId)` in its `finally`.
 *   - `window.beforeunload` (wired in `main.tsx`) calls `abortAllInflight()`.
 *
 * Background-stream semantics: switching routes does NOT abort - the route
 * component does not own the controller. Only app unload does.
 */
const inflight = new Map<string, AbortController>();

export function getOrCreateAbort(threadId: string): AbortController {
  const existing = inflight.get(threadId);
  if (existing) return existing;
  const ac = new AbortController();
  inflight.set(threadId, ac);
  return ac;
}

export function clearAbort(threadId: string): void {
  inflight.delete(threadId);
}

export function abortAllInflight(): void {
  for (const ac of inflight.values()) ac.abort();
  inflight.clear();
}
