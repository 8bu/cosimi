/**
 * Theme management — admin copy. Mirrors apps/web/src/lib/theme.ts with
 * the same storage key so a user who runs both SPAs from one origin
 * (e.g. via a reverse proxy under different paths) doesn't get a
 * mismatched theme between the two.
 *
 * The actual CSS tokens live in @cosimi/ui-tokens/theme.css and respond
 * to `[data-theme="dark"]` on <html>. This module is the JS half: read
 * the persisted choice, apply to the DOM, persist write-through.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "cosimi.theme";

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function resolveInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // non-fatal — see apps/web/src/lib/theme.ts for the rationale.
  }
}

export function bootstrapTheme(): Theme {
  const theme = resolveInitialTheme();
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  return theme;
}
