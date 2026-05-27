import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar } from "@/features/sidebar/components/Sidebar";

interface ChatShellProps {
  children: ReactNode;
}

/**
 * Layout wrapper: renders the chat grid (Sidebar + content) on `/chat/*`
 * paths; passes children through directly elsewhere. Sits inside
 * `<PortfShell>` so the shared shell chrome wraps both modes.
 *
 * Sidebar lives outside the `<main>` slot so its drawer behavior + mobile
 * fixed-position styles don't conflict with the chat-pane layout.
 */
export function ChatShell({ children }: ChatShellProps) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isChat = path.startsWith("/chat");

  if (!isChat) return <>{children}</>;

  return (
    <div className="chat-shell">
      <Sidebar />
      {children}
    </div>
  );
}
