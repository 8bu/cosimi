import { useEffect, useRef, useState } from "react";
import { useMessagesStore } from "@/store/messages";

interface ChatComposerProps {
  threadId: string;
}

/**
 * Single-line composer for an active chat thread. Shape ported from the
 * design source's `InputRow` (`docs/superpowers/artifacts/simlm2/project/
 * primitives.jsx`): `.input-row` wrapper holding a transparent `<input
 * class="input-row-mono">` (mono font, ink-4 placeholder), a `.kbd ⏎`
 * affordance, and a circular `.send-btn` in coral.
 *
 * Submits via `messagesStore.send`. No /teach prefix detection (out of
 * scope per spec §2). Auto-focuses on `threadId` change so switching
 * threads always lands the cursor in the input.
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
        className="input-row-mono"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask a follow-up…"
        aria-label="Ask a follow-up"
      />
      <span className="kbd" aria-hidden="true">
        ⏎
      </span>
      <button type="submit" className="send-btn" disabled={!trimmed} aria-label="Send">
        ↑
      </button>
    </form>
  );
}
