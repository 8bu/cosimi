import { createFileRoute } from "@tanstack/react-router";

import { MobileBurger } from "@/features/sidebar/components/MobileBurger";
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
 *
 * Mobile drawer affordance: the `<MobileBurger />` lives in a
 * `.mobile-topbar` row at the top of the gallery column. The shared
 * `@media (max-width: 768px)` rule in layout.css hides it on desktop
 * and shows it on mobile; without it the sidebar (offscreen via
 * `translateX(-100%)`) has no way to open. Mirrors `<ChatPane>`'s
 * composition.
 */
export const Route = createFileRoute("/artifacts")({
  head: () => ({
    meta: [
      { title: "Artifacts | Long NGUYỄN" },
      {
        name: "description",
        content:
          "Gallery of artifacts: projects, essays, resume, and other artifacts curated by Long NGUYỄN (8bu).",
      },
      { property: "og:title", content: "Artifacts | Long NGUYỄN" },
      {
        property: "og:description",
        content: "Projects, essays, resume, and other artifacts.",
      },
      { property: "og:image", content: "/og/default.png" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://8bu.dev/artifacts" }],
  }),
  component: ArtifactsRoute,
});

function ArtifactsRoute() {
  return (
    <section className="artifacts-shell">
      <Sidebar />
      <div className="artifacts-main">
        <div className="mobile-topbar">
          <MobileBurger />
        </div>
        <ArtifactsGallery />
      </div>
    </section>
  );
}
