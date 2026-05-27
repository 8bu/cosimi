import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/features/chat/types";
import { MessageBubble } from "@/features/chat/components/MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
}

/**
 * Scrolling message list. Auto-scrolls to the bottom on any messages-array
 * identity change.
 *
 * The smooth-scroll `behavior: 'smooth'` is clamped to instant globally by
 * the reduced-motion `@media` rule in `portfolio.css` — no per-component
 * override needed.
 */
export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="message-list" ref={scrollRef}>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  );
}
