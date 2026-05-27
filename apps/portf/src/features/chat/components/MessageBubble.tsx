import type { ChatMessage } from "@/features/chat/types";
import { TypingIndicator } from "@/features/chat/components/TypingIndicator";

/**
 * Renders one chat message bubble. Class names come verbatim from
 * `portfolio.css` (`.bubble-row`, `.bubble-user`, `.bubble-assistant`,
 * `.bubble-sender-assistant`). The `is-error` modifier is added in
 * Phase E's `layout.css` (red border).
 *
 * A bot bubble with empty text AND `status === 'streaming'` renders a
 * `<TypingIndicator>`; once the first token lands, the indicator
 * disappears because `message.text` is non-empty.
 */
interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.kind === "user") {
    return (
      <div className="bubble-row bubble-row-user">
        <div className="bubble bubble-user">{message.text}</div>
      </div>
    );
  }
  const errorClass = message.status === "error" ? " is-error" : "";
  return (
    <div className="bubble-row bubble-row-assistant">
      <span className="bubble-sender bubble-sender-assistant">Long</span>
      <div className={`bubble bubble-assistant${errorClass}`}>
        {message.text ? message.text : message.status === "streaming" ? <TypingIndicator /> : null}
      </div>
    </div>
  );
}
