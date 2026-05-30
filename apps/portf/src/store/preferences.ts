import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "en" | "vi";

interface PreferencesState {
  primaryLocale: Locale;
  setPrimaryLocale: (loc: Locale) => void;
}

/**
 * Portfolio user preferences.
 *
 * Phase D ships `primaryLocale` only. No `theme` key - per spec §7,
 * `data-theme="press"` is hardcoded in `index.html` for v1. A future
 * theme switcher would extend this store; until then, do NOT add a
 * `theme` field to keep the persisted shape stable.
 *
 * Persisted under `portf.preferences` in localStorage. The `portf.*`
 * key prefix is the convention for all apps/portf stores; do not use
 * `cosimi.*` keys here (those belong to apps/web).
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      primaryLocale: "en",
      setPrimaryLocale: (loc) => set({ primaryLocale: loc }),
    }),
    { name: "portf.preferences", version: 1 },
  ),
);
