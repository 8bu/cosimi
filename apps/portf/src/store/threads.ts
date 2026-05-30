import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSessionsStore } from "@/store/sessions";

export interface ThreadIndexEntry {
  id: string;
  ts: number;
  title?: string;
}

interface ThreadsState {
  threads: ThreadIndexEntry[];
  /**
   * Mint a fresh thread id (or accept a caller-supplied one) and prepend
   * to the index. Idempotent: a no-op when `id` is already in the store
   * (used by the bare-/chat redirect path where the ChatPane registers
   * on first send without double-adding if HomePane already registered).
   *
   * IDs use native `crypto.randomUUID()` (RFC4122 v4). Portf runs in HTTPS
   * or localhost only. The CLAUDE.md rule against `crypto.randomUUID()`
   * is for apps/web *session* ids (server-canonical); thread ids are
   * client-only and a different concept.
   */
  create: (id?: string) => string;
  /** Overwrite a thread's title. Visitor-driven via inline rename. */
  rename: (id: string, title: string) => void;
  /**
   * Remove a thread from the index AND cascade-clear sibling stores
   * (messages, sessions). Sessions is cleared synchronously (no circular
   * dep). Messages uses a dynamic import to keep messages.ts out of the
   * threads-store module init graph; errors are swallowed.
   *
   * If the removed thread is the currently active route, the consumer
   * (sidebar row) is responsible for navigating away (e.g., to `/`).
   */
  remove: (id: string) => void;
  /** Bump `ts` to now. Resorts the thread to the top of the sidebar. */
  touch: (id: string) => void;
  /**
   * Write `title` only if the thread currently has no title. Called from
   * messagesStore.send() on the first user message of a thread -
   * subsequent messages do not overwrite a visitor-renamed title.
   */
  setTitleIfEmpty: (id: string, title: string) => void;
}

/**
 * Portfolio thread index.
 *
 * Stores metadata only - `{ id, ts, title? }`. Messages live in the
 * sibling `messages` store; sessions in `sessions`. `remove()` is the
 * cross-store coordinator.
 *
 * Persisted under `portf.threads`. Phase E bumps to `version: 2`
 * (added `title?: string`). The v1 → v2 migration is a type-level
 * change only: existing rows already lack `title`, so passing through
 * untouched is correct.
 */
export const useThreadsStore = create<ThreadsState>()(
  persist(
    (set, get) => ({
      threads: [],
      create: (id) => {
        if (id) {
          const existing = get().threads.find((t) => t.id === id);
          if (existing) return existing.id;
        }
        const next = id ?? crypto.randomUUID();
        const ts = Date.now();
        set((s) => ({ threads: [{ id: next, ts }, ...s.threads] }));
        return next;
      },
      rename: (id, title) =>
        set((s) => ({
          threads: s.threads.map((t) => (t.id === id ? { ...t, title } : t)),
        })),
      remove: (id) => {
        set((s) => ({ threads: s.threads.filter((t) => t.id !== id) }));
        // Sessions cleanup is synchronous - no circular dep between
        // sessions.ts and threads.ts.
        useSessionsStore.getState().clear(id);
        // Messages cleanup via dynamic import - keeps the messages store
        // out of the threads-store module init graph (avoids circular
        // dep risk and keeps threads.ts importable from tests that don't
        // need messages).
        void import("@/store/messages")
          .then((m) => m.useMessagesStore.getState().clear(id))
          .catch(() => {});
      },
      touch: (id) =>
        set((s) => ({
          threads: s.threads.map((t) => (t.id === id ? { ...t, ts: Date.now() } : t)),
        })),
      setTitleIfEmpty: (id, title) =>
        set((s) => ({
          threads: s.threads.map((t) => (t.id === id && !t.title ? { ...t, title } : t)),
        })),
    }),
    {
      name: "portf.threads",
      version: 2,
      migrate: (persisted, version) => {
        // v1 had `{ threads: { id, ts }[] }`. v2 adds optional `title` -
        // pre-existing rows just lack it, so a passthrough is correct.
        if (version < 2) return persisted as ThreadsState;
        return persisted as ThreadsState;
      },
    },
  ),
);
