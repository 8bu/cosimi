import type { PropsWithChildren } from "react";

// Background + base colors only. Column width and vertical layout belong
// to the route itself — the chat route uses 100dvh and a reading-width
// column; future routes may want full-bleed or different widths.
export function AppShell({ children }: PropsWithChildren) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
