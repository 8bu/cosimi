import { toast } from "sonner";
import { create } from "zustand";
import { retrieve } from "@/lib/api/retrieve-client";
import { getLocales } from "@/config/locale";
import type { TuningParams } from "@/lib/api/types";
import type { RetrievalTurn } from "./types";

// minSimilarity 0.45 (benchmarked): bge-m3 relevant ~0.45–0.7, off-topic ~0.32–0.43;
// 0.45 separates them. Lower via the panel for more recall, raise for tighter precision.
const DEFAULT_TUNING: TuningParams = { topK: 8, seedK: 4, maxHops: 2, minSimilarity: 0.45 };
const newId = () => crypto.randomUUID();

interface RetrievalState {
  turns: RetrievalTurn[];
  isLoading: boolean;
  tuning: TuningParams;
  submit: (rawQuery: string) => Promise<void>;
  setTuning: <K extends keyof TuningParams>(key: K, value: TuningParams[K]) => void;
}

export const useRetrieval = create<RetrievalState>((set, get) => ({
  turns: [],
  isLoading: false,
  tuning: DEFAULT_TUNING,
  async submit(rawQuery) {
    if (get().isLoading) return;
    const query = rawQuery.trim();
    if (!query) return;
    const id = newId();
    set((s) => ({ turns: [...s.turns, { id, query, status: "loading" }], isLoading: true }));
    try {
      const result = await retrieve(query, get().tuning, getLocales());
      set((s) => ({
        turns: s.turns.map((t) => (t.id === id ? { id, query, status: "done", result } : t)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "request failed";
      set((s) => ({
        turns: s.turns.map((t) => (t.id === id ? { id, query, status: "error", message } : t)),
      }));
      toast.error("Retrieval failed", { description: message });
    } finally {
      set({ isLoading: false });
    }
  },
  setTuning(key, value) {
    set((s) => ({ tuning: { ...s.tuning, [key]: value } }));
  },
}));
