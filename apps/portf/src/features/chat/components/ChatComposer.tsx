import { useEffect, useRef, useState } from "react";
import { useMessagesStore } from "@/store/messages";

interface ChatComposerProps {
  threadId: string;
}

/**
 * Single-line composer for an active chat thread. Shape ported from the
 * design source's `InputRow` (`docs/superpowers/artifacts/cosimi2/project/
 * primitives.jsx`): `.input-row` wrapper holding a transparent `<input
 * class="input-row-mono">` (mono font, ink-4 placeholder), a `.kbd ⏎`
 * affordance, and a circular `.send-btn` in coral.
 *
 * Compose-while-streaming UX:
 *   - Input is ALWAYS enabled (visitor can draft the next question while
 *     reading the in-flight reply).
 *   - When the thread is streaming and the queue slot is empty: submit
 *     stashes the message via `queueNext`; auto-fires when the stream ends.
 *   - When the queue slot is FULL: send button is disabled (one slot per
 *     thread; no stacking).
 *   - When idle: submit fires `send` directly.
 *   - A small hint below the input shows the queued message preview while
 *     waiting for the stream to settle.
 */
export function ChatComposer({ threadId }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const send = useMessagesStore((s) => s.send);
  const queueNext = useMessagesStore((s) => s.queueNext);
  const isStreaming = useMessagesStore((s) => Boolean(s.streamingByThread[threadId]));
  const queued = useMessagesStore((s) => s.queuedByThread[threadId] ?? null);

  // Initial focus on thread change.
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  const trimmed = value.trim();
  const slotFull = isStreaming && queued !== null;
  const submitDisabled = !trimmed || slotFull;

  return (
    <>
      <form
        className="input-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitDisabled) return;
          if (isStreaming) {
            queueNext(threadId, trimmed);
          } else {
            void send(threadId, trimmed);
          }
          setValue("");
        }}
      >
        <input
          ref={inputRef}
          className="input-row-mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isStreaming ? "Queue a follow-up…" : "Ask a follow-up…"}
          aria-label="Ask a follow-up"
        />
        <span className="kbd" aria-hidden="true">
          ⏎
        </span>
        <button
          type="submit"
          className="send-btn"
          disabled={submitDisabled}
          aria-label={isStreaming ? "Queue" : "Send"}
          title={
            slotFull
              ? "Queue full — wait for the reply"
              : isStreaming
                ? "Queue — sends when the current reply finishes"
                : "Send"
          }
        >
          {isStreaming ? "⏳" : "↑"}
        </button>
      </form>
      {queued && (
        <div className="composer-queue-hint" aria-live="polite">
          <span className="kbd">QUEUED</span> <span className="composer-queue-text">{queued}</span>
        </div>
      )}
    </>
  );
}
