import { useUiStore } from "@/store/ui";
import { Wordmark } from "@/components/Wordmark";
import { NewChatButton } from "@/features/sidebar/components/NewChatButton";
import { ThreadList } from "@/features/sidebar/components/ThreadList";

/**
 * Sidebar composition root. Shape ported from the design source's
 * `V1Sidebar` (`docs/superpowers/artifacts/simlm2/project/
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
        <div style={{ marginBottom: 4 }}>
          {/* Design source passes `sub={null} size={13}` for the sidebar
           * placement — the subtitle "— Senior Web Developer" wraps the
           * 240px sidebar awkwardly when present. Same call signature as
           * `V1Sidebar` in variations-1-2.jsx. */}
          <Wordmark sub={null} size={13} />
        </div>
        <NewChatButton />
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
