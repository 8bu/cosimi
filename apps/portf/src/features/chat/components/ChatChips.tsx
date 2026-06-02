import { useSampledChips } from "@/features/home/use-sampled-chips";
import { useMessagesStore } from "@/store/messages";

interface ChatChipsProps {
  threadId: string;
}

/**
 * Suggestion chips row rendered above the composer inside ChatPane.
 *
 * Shape ported from the design source's `V1Conversation` chip block
 * (`docs/superpowers/artifacts/cosimi2/project/variations-1-2.jsx:80`,
 * `<Chips items={SUGGESTION_CHIPS}>`). Samples a random 5 from the same
 * pool the V2 spotlight HomePane uses (via `useSampledChips`), so the
 * recruiter sees a consistent "menu" both at landing and in-thread.
 *
 * Click → fires `messagesStore.send(threadId, chip.label)`. Disabled
 * mid-stream to avoid interleaved sends (the messages-store guard would
 * push a second placeholder under a stranded in-flight one).
 */
export function ChatChips({ threadId }: ChatChipsProps) {
  const send = useMessagesStore((s) => s.send);
  const chips = useSampledChips(5);

  return (
    <div className="chips" style={{ marginBottom: 10 }}>
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          className="chip"
          onClick={() => {
            void send(threadId, c.label);
          }}
        >
          <span className="chip-mark">{c.mark}</span>
          {c.label}
        </button>
      ))}
    </div>
  );
}
