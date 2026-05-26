import type { PropsWithChildren } from "react";

/**
 * AppShell — the never-unmounting outer wrapper for every route.
 *
 * For Phase C this is a minimal centered viewport that lets the blank
 * `/` show the Wordmark. Sidebar, theme bootstrap, and routing-aware
 * layout (split-pane for artifacts, etc.) land in phases D–G.
 *
 * `data-theme="press"` is set on <html> by index.html (and stays there
 * across navigations because the shell never unmounts). The shell does
 * not set the attribute itself — that would create two writers for the
 * same DOM attribute. Spec §7 fixes the value to "press" for v1.
 */
export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="frame frame-desktop" data-portf-shell>
      {children}
    </div>
  );
}
