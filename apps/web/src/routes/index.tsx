import { ChatHeader } from "@/features/chat/components/ChatHeader";
import { Composer } from "@/features/chat/components/Composer";
import { MessageList } from "@/features/chat/components/MessageList";

// h-[100dvh] (dynamic viewport height) handles iOS Safari's address-bar
// resize correctly — the composer doesn't visually clip when the bar
// retracts/expands. Tailwind v4 supports `dvh` arbitrarily; the
// single-use-site makes adding a custom utility to @simlm/ui-tokens
// premature.
//
// The `-mx-4 sm:-mx-8 px-4 sm:px-8` on the scroll container lets long
// lines scroll behind the side padding rather than visually clipping
// against the column edge, while the page still feels framed.
export default function ChatPage() {
  return (
    <main className="flex flex-col h-[100dvh] max-w-2xl mx-auto px-4 sm:px-8 py-6">
      <ChatHeader />
      <div className="flex-1 overflow-y-auto -mx-4 sm:-mx-8 px-4 sm:px-8">
        <MessageList />
      </div>
      <Composer />
    </main>
  );
}
