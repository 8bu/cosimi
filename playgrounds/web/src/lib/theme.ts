/**
 * Theme management.
 *
 * Tokens in @cosimi/ui-tokens cascade through three precedence levels (see
 * theme.css). This module owns level 1: the explicit user choice,
 * persisted to localStorage and reflected as the `data-theme` attribute
 * on <html>. Reading the attribute is the canonical way to check the
 * effective theme — never re-detect via window.matchMedia from JS, since
 * a user who picked light on a dark-OS machine would read "dark" wrong.
 *
 * `null` means "no explicit choice — defer to prefers-color-scheme".
 * The toggle cycles light → dark → light (never back to null) once the
 * user has interacted; resetting to OS-follow would need a separate
 * affordance and product hasn't asked for it.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "cosimi.theme";

/**
 * Read the persisted choice from localStorage. Returns null on first
 * load, an invalid value, or when localStorage is unavailable (e.g.
 * Safari private mode). Callers should treat null as "follow OS".
 */
export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the effective theme: stored choice if any, otherwise the OS
 * preference. Used at boot to decide whether to set `data-theme="dark"`
 * before first paint.
 */
export function resolveInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

/**
 * Apply the theme to the DOM. Sets `data-theme` on <html> and persists
 * to localStorage. Idempotent — calling with the same value re-sets the
 * attribute without churn. SSR-safe via the document guard.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage write failures (private mode, quota) are non-fatal —
    // the attribute is already set so the theme will apply for this
    // session; persistence simply won't survive the reload.
  }
}

/**
 * Bootstrap helper — call from main.tsx before first render to avoid a
 * light → dark flash for persisted-dark users on a dark OS.
 */
export function bootstrapTheme(): Theme {
  const theme = resolveInitialTheme();
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  return theme;
}
