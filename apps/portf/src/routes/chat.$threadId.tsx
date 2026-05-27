import { createFileRoute, useLocation } from "@tanstack/react-router";

/**
 * Phase D stub for the chat route.
 *
 * Displays the resolved threadId and (if present on history state) the
 * first prompt the visitor submitted on `/`. Phase E replaces this with
 * the real ChatPane (Sidebar in PortfShell, message list, composer, SSE).
 *
 * `initialPrompt` is typed via the `HistoryState` augmentation in
 * `apps/portf/src/types/router.d.ts`.
 */
function ChatStub() {
  const { threadId } = Route.useParams();
  const initialPrompt = useLocation({
    select: (loc) => loc.state.initialPrompt,
  });

  return (
    <section
      data-portf-chat-stub
      style={{ padding: "2rem", fontFamily: "var(--font-mono)" }}
    >
      <p>threadId: {threadId}</p>
      {initialPrompt ? <p>first prompt: {initialPrompt}</p> : null}
      <p style={{ opacity: 0.6, marginTop: "1rem" }}>ChatPane (Phase E)</p>
    </section>
  );
}

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatStub,
});
