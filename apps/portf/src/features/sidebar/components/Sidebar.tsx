import { useUiStore } from "@/store/ui";
import { Wordmark } from "@/components/Wordmark";
import { NewChatButton } from "@/features/sidebar/components/NewChatButton";
import { ThreadList } from "@/features/sidebar/components/ThreadList";

/**
 * Sidebar composition root. Renders the `<aside class=v1-sidebar>` aside
 * plus a separate `.sidebar-backdrop` overlay used by the mobile drawer
 * (visibility controlled by CSS @media in `layout.css`).
 *
 * The backdrop is always in the DOM when the drawer is open (regardless
 * of viewport) — CSS handles the show/hide. This keeps drawer state +
 * DOM consistent across resizes.
 */
export function Sidebar() {
  const isOpen = useUiStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`v1-sidebar${isOpen ? " is-open" : ""}`}>
        <Wordmark />
        <NewChatButton />
        <span className="v1-section-label">Threads</span>
        <ThreadList />
      </aside>
    </>
  );
}
