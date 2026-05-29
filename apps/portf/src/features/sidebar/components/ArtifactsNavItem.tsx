import { Link } from "@tanstack/react-router";
import { useUiStore } from "@/store/ui";
import { totalGalleryItems } from "@/features/artifacts-index/data";

/**
 * Sidebar nav row pointing at `/artifacts`. Sits under `<NewChatButton />`
 * and above `<ThreadList />` per the design-source hand-off
 * (chat2.md:111). The bordered mini-square icon (`.v1-nav-ico`) stands
 * in for the `.v1-dot` so the row reads as a document/library entry
 * rather than a chat thread. Item count comes from the catalog so it
 * stays in sync as MDX files are added.
 *
 * Active state is delegated to TanStack Router's <Link> — when no
 * `activeProps` is supplied it auto-appends `className="active"` on the
 * matched route. Don't add a manual pathname check; doing so produced
 * `active active` duplicated on the rendered <a>. Closes the mobile
 * drawer on click so the new route renders without an open sidebar
 * covering it.
 */
export function ArtifactsNavItem() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const count = totalGalleryItems();

  return (
    <Link
      to="/artifacts"
      onClick={() => setSidebarOpen(false)}
      className="v1-thread v1-nav-item"
      aria-label="Browse all artifacts"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <span className="v1-nav-ico" aria-hidden="true" />
      <span>Artifacts</span>
      <span className="v1-nav-count">{String(count).padStart(2, "0")}</span>
    </Link>
  );
}
