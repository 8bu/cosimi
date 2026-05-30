import { useNavigate } from "@tanstack/react-router";
import { useThreadsStore } from "@/store/threads";
import { useUiStore } from "@/store/ui";

/**
 * Sidebar "+ NEW CHAT" CTA. Mints a fresh thread (eager registration -
 * operator pick) and navigates. Closes the mobile drawer if open.
 *
 * Eager registration here intentionally diverges from the bare-/chat
 * deferred-registration rule: the visitor explicitly clicked New Chat,
 * so a row should appear. If the visitor bounces without sending,
 * `threads.remove` is one click away.
 */
export function NewChatButton() {
  const navigate = useNavigate();
  const create = useThreadsStore((s) => s.create);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <button
      type="button"
      className="v1-new-btn"
      onClick={() => {
        const id = create();
        setSidebarOpen(false);
        void navigate({
          to: "/chat/$threadId",
          params: { threadId: id },
          search: { artifact: undefined },
        });
      }}
    >
      <span className="plus">+</span> NEW CHAT
    </button>
  );
}
