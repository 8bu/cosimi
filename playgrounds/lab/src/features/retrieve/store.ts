import { create } from "zustand";
import { toast } from "sonner";
import { retrieve } from "@/lib/api/retrieve-client";
import { toRetrieveVM } from "@/lib/adapters";
import type { HitVM, RetrieveVM } from "@/lib/adapters";
import type { TuningParams } from "@/lib/api/raw-types";
import { getLocales } from "@/config/locale";

type DocTitleFn = (docId: string) => string | null;

interface RetrieveState {
  result: RetrieveVM | null;
  isLoading: boolean;
  tuning: TuningParams;
  activeHit: HitVM | null;
  submit: (query: string, docTitle: DocTitleFn) => Promise<void>;
  setTuning: <K extends keyof TuningParams>(key: K, val: TuningParams[K]) => void;
  setActiveHit: (hit: HitVM | null) => void;
}

const DEFAULT_TUNING: TuningParams = { topK: 5, seedK: 4, maxHops: 2, minSimilarity: 0.45 };

export const useRetrieveStore = create<RetrieveState>((set, get) => ({
  result: null,
  isLoading: false,
  tuning: DEFAULT_TUNING,
  activeHit: null,

  async submit(query, docTitle) {
    const trimmed = query.trim();
    if (get().isLoading || trimmed.length === 0) return;
    set({ isLoading: true });
    const t0 = performance.now();
    try {
      const raw = await retrieve(trimmed, get().tuning, getLocales());
      const tookMs = Math.round(performance.now() - t0);
      set({ result: toRetrieveVM(trimmed, raw, docTitle, tookMs), activeHit: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retrieval failed");
    } finally {
      set({ isLoading: false });
    }
  },

  setTuning(key, val) {
    set((s) => ({ tuning: { ...s.tuning, [key]: val } }));
  },

  setActiveHit(hit) {
    set({ activeHit: hit });
  },
}));
