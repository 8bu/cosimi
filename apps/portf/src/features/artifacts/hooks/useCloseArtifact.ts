import { useRouter, useRouterState } from "@tanstack/react-router";

/**
 * Single close handler used by × button, ← BACK pill, and Esc key inside
 * the artifact pane. On `/chat` (or anywhere that's NOT a standalone
 * `/artifact/*` route), pops history. On `/artifact/*` cold-landed
 * (history.length <= 1), navigates to `/chat` so the visitor doesn't get
 * stranded leaving the site.
 */
export function useCloseArtifact() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return {
    close: () => {
      const isStandalone = pathname.startsWith("/artifact/");
      if (isStandalone && window.history.length <= 1) {
        router.navigate({ to: "/chat" });
      } else {
        router.history.back();
      }
    },
  };
}
