import { useNavigate } from "@tanstack/react-router";
import { getDescriptor } from "@/features/artifacts/catalog";
import { ArtifactPreviewCard } from "@/features/artifacts/components/ArtifactPreviewCard";
import type { ArtifactDescriptor } from "@/features/artifacts/types";
import type { ChatMessage } from "@/features/chat/types";
import { MarkdownBubble } from "@/features/chat/components/MarkdownBubble";
import { TypingIndicator } from "@/features/chat/components/TypingIndicator";

/**
 * Renders one chat message bubble. Shape ported verbatim from the design
 * source (`docs/superpowers/artifacts/cosimi2/project/primitives.jsx`
 * UserBubble / AssistantBubble): row wrapper carries `bubble-sender`
 * label above the bubble itself. User label = lowercase "you", bot label
 * = "8BU" wordmark in coral.
 *
 * Class names come from `portfolio.css` verbatim (`.bubble-row`,
 * `.bubble-user`, `.bubble-assistant`, `.bubble-sender-*`). The
 * `is-error` modifier lives in `layout.css` (red border).
 *
 * Bot bubble with empty text + `status === 'streaming'` renders a
 * `<TypingIndicator>`; once the first token lands the indicator
 * disappears because `message.text` is non-empty.
 */
interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const navigate = useNavigate();
  if (message.kind === "user") {
    return (
      <div className="bubble-row bubble-row-user">
        <span className="bubble-sender bubble-sender-user">you</span>
        <div className="bubble bubble-user">{message.text}</div>
      </div>
    );
  }
  const errorClass = message.status === "error" ? " is-error" : "";
  const artifact = message.artifactSlug ? getDescriptor(message.artifactSlug) : null;
  return (
    <div className="bubble-row bubble-row-assistant">
      <span className="bubble-sender bubble-sender-assistant">8BU</span>
      <div className={`bubble bubble-assistant${errorClass}`}>
        {message.text ? (
          <MarkdownBubble text={message.text} />
        ) : message.status === "streaming" ? (
          <TypingIndicator />
        ) : null}
        {artifact ? (
          <ArtifactPreviewCard
            descriptor={artifact}
            onOpen={(d: ArtifactDescriptor) =>
              navigate({
                to: ".",
                search: (prev: Record<string, unknown>) => ({ ...prev, artifact: d.slug }),
              })
            }
          />
        ) : null}
      </div>
    </div>
  );
}
