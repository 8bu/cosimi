import { useMessagesStore } from "@/store/messages";
import { ChatComposer } from "@/features/chat/components/ChatComposer";
import { EmptyChatPane } from "@/features/chat/components/EmptyChatPane";
import { MessageList } from "@/features/chat/components/MessageList";
import { MobileBurger } from "@/features/sidebar/components/MobileBurger";
import type { ChatMessage } from "@/features/chat/types";

interface ChatPaneProps {
  threadId: string;
}

// Module-level empty array — referenced by the zustand selector so an
// empty thread doesn't allocate a new array per render and trigger
// shallow-eq false alarms.
const EMPTY: readonly ChatMessage[] = Object.freeze([]);

/**
 * Composition root for `/chat/$threadId`. Reads the thread's messages
 * slice from the messages store, renders empty placeholder or list,
 * mounts the composer, and stamps a mobile-topbar burger (CSS @media
 * shows it only at narrow viewports).
 */
export function ChatPane({ threadId }: ChatPaneProps) {
  const messages = useMessagesStore((s) => s.byThread[threadId] ?? EMPTY);
  return (
    <main className="chat-pane">
      <div className="mobile-topbar">
        <MobileBurger />
      </div>
      {messages.length === 0 ? (
        <EmptyChatPane />
      ) : (
        <MessageList messages={messages as ChatMessage[]} />
      )}
      <ChatComposer threadId={threadId} />
    </main>
  );
}
