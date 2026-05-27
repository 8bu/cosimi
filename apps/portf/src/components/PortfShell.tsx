import type { PropsWithChildren } from "react";

/**
 * PortfShell - the never-unmounting outer wrapper for every route.
 *
 * Phase D rename of AppShell (spec terminology). Content unchanged: a minimal
 * centered viewport. Sidebar, theme bootstrap, and split-pane layout for
 * artifacts land in phases E–G.
 *
 * `data-theme="press"` is set on <html> by index.html (and stays there across
 * navigations because the shell never unmounts). The shell does not set the
 * attribute itself - that would create two writers for the same DOM attribute.
 * Spec §7 fixes the value to "press" for v1.
 */
export function PortfShell({ children }: PropsWithChildren) {
  return (
    <div className="frame frame-desktop" data-portf-shell>
      {children}
    </div>
  );
}
