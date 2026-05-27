import { useEffect, useRef, useState } from "react";
import { useMessagesStore } from "@/store/messages";

interface ChatComposerProps {
  threadId: string;
}

/**
 * Single-line composer for an active chat thread. Mirrors HomePane's
 * Composer wrapper (`.input-row`) but submits via `messagesStore.send`
 * instead of navigating. No /teach prefix detection (out of scope per
 * spec §2).
 *
 * Auto-focuses on `threadId` change so switching threads always lands
 * the cursor in the input. Send button disabled until input has content.
 */
export function ChatComposer({ threadId }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const send = useMessagesStore((s) => s.send);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  const trimmed = value.trim();

  return (
    <form
      className="input-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        setValue("");
        void send(threadId, trimmed);
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ask anything…"
      />
      <button type="submit" disabled={!trimmed}>
        send
      </button>
    </form>
  );
}
