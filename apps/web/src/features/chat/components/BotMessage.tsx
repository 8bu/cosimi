import { useState } from "react";
import { MatchBadge } from "@/features/chat/components/MatchBadge";
import { TeachComposer } from "@/features/chat/components/TeachComposer";
import { VoteButtons } from "@/features/chat/components/VoteButtons";
import type { BotMsg } from "@/features/chat/types";

export function BotMessage({ msg }: { msg: BotMsg }) {
  const [teachOpen, setTeachOpen] = useState(false);
  const showCta = msg.status === "settled" && (msg.noMatch || msg.meta?.lowConfidence === true);

  return (
    <article className="flex flex-col gap-1.5 py-3 pl-4 border-l-2 border-primary/50">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-primary">Bé Sim</div>
      <div className="prose-chat text-foreground whitespace-pre-wrap break-words">
        {msg.text || (msg.noMatch ? "hmm idk, tell me more?" : "")}
        {msg.status === "streaming" && (
          <span
            aria-hidden
            className="inline-block w-[2px] h-[1.1em] ml-0.5 align-text-bottom bg-foreground/70 animate-pulse"
          />
        )}
      </div>

      {msg.status === "settled" && (
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-1 text-xs">
          <MatchBadge meta={msg.meta} noMatch={msg.noMatch} />
          {msg.meta?.pairId != null && <VoteButtons msg={msg} />}
          {showCta && (
            <button
              type="button"
              onClick={() => setTeachOpen((o) => !o)}
              className="text-primary hover:underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
            >
              Teach a better reply
            </button>
          )}
        </div>
      )}

      {teachOpen && (
        <div className="mt-2">
          <TeachComposer onSubmit={() => setTeachOpen(false)} forInput={msg.userInput} />
        </div>
      )}
    </article>
  );
}
