import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyTheme, resolveInitialTheme, type Theme } from "@/lib/theme";

/**
 * Admin theme toggle. Same shape as apps/web's ThemeToggle but uses
 * local React state rather than a zustand store — the admin app has no
 * non-React caller that needs an imperative read of the theme, and a
 * dedicated store would be premature abstraction for a single toggle.
 *
 * Initial state is read from `resolveInitialTheme()` on mount; main.tsx
 * has already set `data-theme` on <html>, so this just mirrors what's
 * already in the DOM.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === "undefined" ? "light" : resolveInitialTheme(),
  );

  // Reconcile state with whatever main.tsx wrote pre-render (StrictMode
  // double-invoke makes the initial-state lazy initializer safe; this
  // effect is for any post-mount drift, e.g. a tab the user changed
  // theme on syncing back via storage events).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== "cosimi.theme") return;
      const next = e.newValue === "dark" ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
