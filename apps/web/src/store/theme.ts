import { create } from "zustand";
import { applyTheme, resolveInitialTheme, type Theme } from "@/lib/theme";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

/**
 * Zustand wrapper around the theme helper. The initial value is read at
 * module-init time via resolveInitialTheme() — that's a one-shot read of
 * localStorage + matchMedia, identical to bootstrapTheme() in lib/theme.
 * main.tsx calls bootstrapTheme() before render to set the DOM attribute
 * before first paint; the store's initial value just mirrors what the
 * DOM already shows.
 *
 * No persist middleware here — lib/theme owns the localStorage I/O, and
 * applyTheme writes through to the DOM + storage on every set. A second
 * write via zustand-persist would be redundant.
 */
export const useTheme = create<ThemeState>((set, get) => ({
  theme: typeof document === "undefined" ? "light" : resolveInitialTheme(),
  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
  },
}));
