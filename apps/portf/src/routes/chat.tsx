import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /chat layout route.
 *
 * On a bare /chat hit (no $threadId child segment), redirects to
 * /chat/<freshUuid>. The redirect uses `replace: true` so the bare URL
 * does not leave a history entry the visitor would back into.
 *
 * The minted UUID is intentionally NOT added to the threads store - bare
 * /chat is a deep-link convenience and we don't know if the visitor will
 * actually send a message. Phase E will revisit (either auto-create on
 * first message or have this route call threads.create() upfront).
 *
 * `beforeLoad` throwing `redirect()` is the TanStack-canonical pattern -
 * `redirect` is a thrown sentinel, NOT a returned value. Returning it
 * would type-check but silently not redirect at runtime.
 */
export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat | Long NGUYỄN" },
      { name: "description", content: "Ask me anything." },
      { property: "og:title", content: "Chat | Long NGUYỄN" },
      { property: "og:description", content: "Ask me anything." },
      { property: "og:image", content: "/og/default.png" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://8bu.dev/chat" }],
  }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/chat" || location.pathname === "/chat/") {
      throw redirect({
        to: "/chat/$threadId",
        params: { threadId: crypto.randomUUID() },
        search: { artifact: undefined },
        replace: true,
      });
    }
  },
  component: () => <Outlet />,
});
