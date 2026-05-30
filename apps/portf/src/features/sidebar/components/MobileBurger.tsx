import { useUiStore } from "@/store/ui";

/**
 * Burger icon button visible only at mobile breakpoints (controlled by
 * `.mobile-topbar` `@media` rules in `layout.css`). Toggles the sidebar
 * drawer state.
 */
export function MobileBurger() {
  const toggle = useUiStore((s) => s.toggleSidebar);
  return (
    <button type="button" className="mob-icon-btn" aria-label="Open thread list" onClick={toggle}>
      ☰
    </button>
  );
}
