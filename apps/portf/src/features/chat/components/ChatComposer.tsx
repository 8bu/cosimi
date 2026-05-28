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
 *
 * Disabled-while-streaming pattern mirrors `apps/web`'s Composer: both
 * input + send button gate on `streamingByThread[threadId]`; on the
 * streaming -> idle transition we re-focus the input so the visitor
 * keeps typing without reaching for the mouse between turns.
 */
export function ChatComposer({ threadId }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const send = useMessagesStore((s) => s.send);
  const isStreaming = useMessagesStore((s) => Boolean(s.streamingByThread[threadId]));

  // Initial focus on thread change.
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  // Re-focus on streaming -> idle transition. The input is `disabled` while
  // streaming (browser blurs disabled elements), so this restores the cursor
  // for the next turn without the visitor reaching for the mouse.
  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus();
  }, [isStreaming]);

  const trimmed = value.trim();

  return (
    <form
      className="input-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed || isStreaming) return;
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
        disabled={isStreaming}
      />
      <span className="kbd" aria-hidden="true">
        ⏎
      </span>
      <button
        type="submit"
        className="send-btn"
        disabled={!trimmed || isStreaming}
        aria-label="Send"
      >
        ↑
      </button>
    </form>
  );
}
