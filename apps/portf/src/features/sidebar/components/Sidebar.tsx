import { Link } from "@tanstack/react-router";
import { useUiStore } from "@/store/ui";
import { Wordmark } from "@/components/Wordmark";
import { NewChatButton } from "@/features/sidebar/components/NewChatButton";
import { ArtifactsNavItem } from "@/features/sidebar/components/ArtifactsNavItem";
import { ThreadList } from "@/features/sidebar/components/ThreadList";

/**
 * Sidebar composition root. Shape ported from the design source's
 * `V1Sidebar` (`docs/superpowers/artifacts/cosimi2/project/
 * variations-1-2.jsx`): Wordmark header, `+ NEW CHAT` button,
 * `<ThreadList>` (Today / Earlier bucketed), avatar + email footer
 * pinned to the bottom via `margin-top: auto`.
 *
 * The mobile drawer is a sibling `.sidebar-backdrop` rendered when the
 * UI store says open; CSS @media in `layout.css` toggles visibility per
 * viewport. State + DOM stay consistent across resizes.
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
        {/* Wordmark doubles as the home link - standard chat-app pattern
         * (Slack, Linear, Claude all do this). Closing the mobile drawer
         * via the ui store keeps the drawer state consistent after the
         * route change.
         *
         * Design source passes `sub={null} size={13}` (V1Sidebar in
         * variations-1-2.jsx) - the subtitle "- Senior Web Developer"
         * wraps the 240px sidebar awkwardly when present. */}
        <Link
          to="/"
          onClick={() => setSidebarOpen(false)}
          style={{
            display: "block",
            marginBottom: 4,
            textDecoration: "none",
            color: "inherit",
            cursor: "pointer",
          }}
          aria-label="Back to home"
        >
          <Wordmark sub={null} size={13} />
        </Link>
        <NewChatButton />
        <div className="v1-section-label">Resources</div>
        <ArtifactsNavItem />
        <ThreadList />

        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            borderTop: "1px dashed var(--line)",
          }}
        >
          <div className="v1-thread" style={{ background: "transparent", cursor: "default" }}>
            <img
              src="/long-avatar.png"
              alt="Long"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                border: "1px solid var(--line)",
              }}
            />
            <span>hvanlong@pm.me</span>
          </div>
        </div>
      </aside>
    </>
  );
}
