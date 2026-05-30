import { useThreadsStore } from "@/store/threads";
import type { ChatMessage } from "@/features/chat/types";

interface ChatHeaderProps {
  threadId: string;
  messages: readonly ChatMessage[];
}

/**
 * Chat-pane header. Shape ported from the design source's
 * `V1Conversation` (`docs/superpowers/artifacts/cosimi2/project/
 * variations-1-2.jsx` line 52–57): big serif title on the left,
 * mono-caps status (`.kbd`) on the right.
 *
 * Title comes from the persisted thread entry (set by the first
 * user message via `setTitleIfEmpty`). Status is derived from the
 * latest bot message status so the visitor can see "STREAMING" or
 * the resting state at a glance.
 */
function statusFor(messages: readonly ChatMessage[]): string {
  if (messages.length === 0) return "thread · started just now";
  const last = messages[messages.length - 1];
  if (last && last.kind === "bot") {
    if (last.status === "streaming") return "just sent · streaming";
    if (last.status === "error") return "error · try again";
    if (last.noMatch) return "no match · try rephrasing";
    return "replied";
  }
  return "just sent";
}

export function ChatHeader({ threadId, messages }: ChatHeaderProps) {
  const title = useThreadsStore((s) => s.threads.find((t) => t.id === threadId)?.title);
  const status = statusFor(messages);

  return (
    <div
      className="chat-header"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 18,
        gap: 16,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: "var(--headline-weight)",
          fontStyle: "var(--headline-style)",
          margin: 0,
          letterSpacing: "var(--headline-tracking)",
          textOverflow: "ellipsis",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {title ?? "Untitled thread"}
      </h3>
      <span className="kbd" style={{ flexShrink: 0 }}>
        {status}
      </span>
    </div>
  );
}
