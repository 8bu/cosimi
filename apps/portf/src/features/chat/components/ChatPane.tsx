import { useMessagesStore } from "@/store/messages";
import { ChatChips } from "@/features/chat/components/ChatChips";
import { ChatComposer } from "@/features/chat/components/ChatComposer";
import { ChatHeader } from "@/features/chat/components/ChatHeader";
import { EmptyChatPane } from "@/features/chat/components/EmptyChatPane";
import { MessageList } from "@/features/chat/components/MessageList";
import { MobileBurger } from "@/features/sidebar/components/MobileBurger";
import type { ChatMessage } from "@/features/chat/types";

interface ChatPaneProps {
  threadId: string;
}

// Module-level empty array - referenced by the zustand selector so an
// empty thread doesn't allocate a new array per render and trigger
// shallow-eq false alarms.
const EMPTY: readonly ChatMessage[] = Object.freeze([]);

/**
 * Composition root for `/chat/$threadId`. Shape ported from the design
 * source's `V1Conversation` (`docs/superpowers/artifacts/cosimi2/project/
 * variations-1-2.jsx` line 49–85): header (title + status), middle
 * messages slot, footer = chips + composer.
 *
 * Mobile burger sits above the header in a `.mobile-topbar` row (CSS
 * @media in `layout.css` shows it only at narrow viewports).
 */
export function ChatPane({ threadId }: ChatPaneProps) {
  const messages = useMessagesStore((s) => s.byThread[threadId] ?? EMPTY);

  return (
    <main className="chat-pane">
      <div className="mobile-topbar">
        <MobileBurger />
      </div>
      <ChatHeader threadId={threadId} messages={messages} />
      <div className="chat-pane__messages">
        {messages.length === 0 ? (
          <EmptyChatPane />
        ) : (
          <MessageList messages={messages as ChatMessage[]} />
        )}
      </div>
      <div className="chat-pane__footer">
        <ChatChips threadId={threadId} />
        <ChatComposer threadId={threadId} />
      </div>
    </main>
  );
}
