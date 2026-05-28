import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar } from "@/features/sidebar/components/Sidebar";
import { getDescriptor } from "@/features/artifacts/catalog";
import { ArtifactPane } from "@/features/artifacts/components/ArtifactPane";

interface ChatShellProps {
  children: ReactNode;
}

/**
 * Layout wrapper. On `/chat/*` paths, renders a grid: sidebar + conversation
 * (+ artifact pane if `?artifact=<slug>` is set and resolves to a descriptor).
 * On other paths, passes children through.
 *
 * The third column is gated by both: (a) a slug in the search param, AND
 * (b) the catalog actually having that slug. Stale slugs (after MDX rename)
 * degrade gracefully to the 2-col shape, matching Phase F's MessageBubble
 * graceful-degradation pattern.
 *
 * The `data-artifact-open` attribute drives the CSS grid-template-columns
 * swap (see layout.css). Mobile (<=768px) media query promotes the artifact
 * column to position-fixed fullscreen.
 */
export function ChatShell({ children }: ChatShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, unknown>;
  const isChat = pathname.startsWith("/chat");
  const slug = isChat && typeof search.artifact === "string" ? search.artifact : null;
  const descriptor = slug ? getDescriptor(slug) : null;

  if (!isChat) return <>{children}</>;

  return (
    <section className="chat-shell" data-artifact-open={descriptor ? "true" : "false"}>
      <Sidebar />
      {children}
      {descriptor && <ArtifactPane descriptor={descriptor} />}
    </section>
  );
}
