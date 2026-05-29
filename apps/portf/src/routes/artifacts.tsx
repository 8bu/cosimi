import { createFileRoute } from "@tanstack/react-router";

import { Sidebar } from "@/features/sidebar/components/Sidebar";
import { ArtifactsGallery } from "@/features/artifacts-index/components/ArtifactsGallery";

/**
 * /artifacts - the browse-everything index page.
 *
 * Shape mirrors `<ChatShell>` (sidebar column + main column) but lives
 * outside it: ChatShell only wraps `/chat/*` paths. This route renders
 * its own grid via `.artifacts-shell`, drops in the same `<Sidebar />`
 * so chat-thread navigation stays one click away, and mounts
 * `<ArtifactsGallery />` in place of the chat pane.
 */
export const Route = createFileRoute("/artifacts")({
  component: ArtifactsRoute,
});

function ArtifactsRoute() {
  return (
    <section className="artifacts-shell">
      <Sidebar />
      <ArtifactsGallery />
    </section>
  );
}
