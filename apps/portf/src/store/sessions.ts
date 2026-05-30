import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionsState {
  byThread: Record<string, string>;
  set: (threadId: string, serverId: string) => void;
  get: (threadId: string) => string | undefined;
  clear: (threadId: string) => void;
}

/**
 * Per-thread server session map.
 *
 * Key: client-minted `threadId`. Value: server-minted session id, adopted
 * from the `X-Session-Id` response header on the first POST per thread
 * (`lib/streamChat.ts`). Subsequent posts for that thread send the cached
 * id back to the server, which keeps `session_teaches` / rate-limit budget
 * scoped per thread.
 *
 * CLAUDE.md rule preserved: session ids are server-canonical. We NEVER
 * mint them client-side. Thread ids are client-minted (different concept).
 *
 * Persisted under `portf.sessions` via zustand `persist`. Token-write cost
 * is one entry per first-POST per thread - negligible, no debounce.
 */
export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      byThread: {},
      set: (threadId, serverId) =>
        set((s) => ({
          byThread: { ...s.byThread, [threadId]: serverId },
        })),
      get: (threadId) => get().byThread[threadId],
      clear: (threadId) =>
        set((s) => {
          const next = { ...s.byThread };
          delete next[threadId];
          return { byThread: next };
        }),
    }),
    { name: "portf.sessions", version: 1 },
  ),
);
