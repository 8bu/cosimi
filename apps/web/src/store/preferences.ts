import { create } from "zustand";
import { persist } from "zustand/middleware";

// MVP locales: Vietnamese + English. Adding a third later (ja, zh-Hant…)
// is: add a dict file at apps/web/src/lib/i18n/<x>.ts, append the option
// to LocaleSwitcher's OPTIONS list (or extract a tokens module), seed
// fallback_message_<x> in a new migration. No schema work, no store
// rewrites. Keep this union narrow so a typo at a call site fails
// typecheck instead of silently writing an unknown locale through.
export type Locale = "vi" | "en";
export const SUPPORTED_LOCALES: readonly Locale[] = ["vi", "en"] as const;
const DEFAULT_LOCALE: Locale = "en";

interface PreferencesState {
  primaryLocale: Locale;
  setPrimaryLocale: (l: Locale) => void;
}

/**
 * UI preferences (locale, future per-user settings). Persisted to
 * localStorage under 'simlm.preferences' — separate from useSession's
 * 'simlm.session' so resetting one doesn't nuke the other. The chat API
 * reads `primaryLocale` imperatively at call time (same pattern as
 * apiFetch's session-id read).
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      primaryLocale: DEFAULT_LOCALE,
      setPrimaryLocale: (l) => set({ primaryLocale: l }),
    }),
    { name: "simlm.preferences" },
  ),
);

/** Imperative handle for non-React code (api/chat.ts reads via this). */
export const preferencesStore = usePreferences;
