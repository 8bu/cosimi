import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  sessionId: string | null;
  setSessionId: (id: string) => void;
  reset: () => void;
}

/**
 * Session id is server-canonical: apps/api's withSession middleware mints
 * one on first contact and echoes it on every response. The client adopts
 * whatever comes back — no client-side crypto.randomUUID(). The persist
 * middleware writes to localStorage under the key 'simlm.session' so the
 * id survives reloads; a thumbs-vote or /teach made in one tab still
 * belongs to the same session in the next.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),
      reset: () => set({ sessionId: null }),
    }),
    { name: "simlm.session" },
  ),
);

/** Imperative handle for non-React code (api/client.ts reads/writes via this). */
export const sessionStore = useSession;
