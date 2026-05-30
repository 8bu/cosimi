import { useEffect, useRef } from "react";
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { ChatPane } from "@/features/chat/components/ChatPane";
import { useMessagesStore } from "@/store/messages";

/**
 * /chat/$threadId - real ChatPane mount (replaces Phase D's stub).
 *
 * If `location.state.initialPrompt` is present (HomePane Composer
 * submits with that on navigation), enqueue it as the thread's first
 * send and clear the history state via `navigate({ state: {} })` so
 * back/forward + reload don't re-fire.
 *
 * `consumedRef` defeats React StrictMode's double-mount re-fire: state
 * flags would be async (next render); the ref check happens
 * synchronously in the effect body.
 */
export const Route = createFileRoute("/chat/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat | Long NGUYỄN" },
      { name: "description", content: "Ask me anything." },
      { property: "og:title", content: "Chat | Long NGUYỄN" },
      { property: "og:description", content: "Ask me anything." },
      { property: "og:image", content: "/og/default.png" },
      { property: "og:type", content: "website" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    artifact: typeof search.artifact === "string" ? search.artifact : undefined,
  }),
  component: function RouteComponent() {
    const { threadId } = Route.useParams();
    const navigate = Route.useNavigate();
    return <ChatPaneRoute params={{ threadId }} navigate={navigate} />;
  },
});

interface ChatPaneRouteProps {
  params: { threadId: string };
  navigate: (opts: { to: "."; replace: true; search: true; state: object }) => void;
}

/**
 * Inner component. Exported so unit tests can render it without
 * registering a TanStack route in jsdom.
 */
export function ChatPaneRoute({ params, navigate }: ChatPaneRouteProps) {
  const { threadId } = params;
  const initialPrompt = useLocation({
    select: (loc) => loc.state.initialPrompt,
  });
  const consumedRef = useRef(false);

  useEffect(() => {
    if (!initialPrompt || consumedRef.current) return;
    consumedRef.current = true;
    void useMessagesStore.getState().send(threadId, initialPrompt);
    void navigate({ to: ".", replace: true, search: true, state: {} });
  }, [threadId, initialPrompt, navigate]);

  return <ChatPane threadId={threadId} />;
}
