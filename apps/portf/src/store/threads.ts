import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ThreadIndexEntry {
  id: string;
  ts: number;
}

interface ThreadsState {
  threads: ThreadIndexEntry[];
  /**
   * Mint a fresh thread id, prepend to the index, persist, and return the id.
   * Phase D's only action. Phase E adds rename/remove/touch/setTitle/revisit
   * and grows the entry shape with `title?`, `lastSnippet?`, `pinned?`.
   */
  create: () => string;
}

/**
 * Portfolio thread index.
 *
 * Stores metadata only — `{ id, ts }`. Messages are NOT in this store; per
 * spec §10 they will land in a sibling `messages-by-thread` store in Phase E.
 * Conceptually: this store is the sidebar's data; messages are the chat
 * pane's data.
 *
 * IDs use native `crypto.randomUUID()` (RFC4122 v4). Portf runs in HTTPS or
 * localhost only, where the WebCrypto API is always defined; no `uuid`
 * dependency needed. (The CLAUDE.md rule against `crypto.randomUUID()` is for
 * session IDs in apps/web, which must be server-canonical; thread IDs are
 * client-only and a different concept.)
 *
 * Persisted under `portf.threads` in localStorage.
 */
export const useThreadsStore = create<ThreadsState>()(
  persist(
    (set) => ({
      threads: [],
      create: () => {
        const id = crypto.randomUUID();
        const ts = Date.now();
        set((s) => ({ threads: [{ id, ts }, ...s.threads] }));
        return id;
      },
    }),
    { name: "portf.threads", version: 1 },
  ),
);
