import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/store/theme";

/**
 * Two-state toggle (light ↔ dark). Once the user touches it, the
 * preference is sticky — there's no "follow OS" mode. Re-detecting via
 * matchMedia after an explicit choice would silently override the
 * user's last action when they switch OS themes, which is exactly the
 * surprise dark-mode toggles exist to prevent.
 *
 * The icon shows the *target* state (sun = "switch to light", moon =
 * "switch to dark") rather than the current one — matches the iOS /
 * macOS convention. aria-label is the action description, not a static
 * "Theme" label, so screen readers announce the outcome of activation.
 */
export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
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
