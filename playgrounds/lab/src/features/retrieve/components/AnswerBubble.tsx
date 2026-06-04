import { useState } from "react";
import type { RetrievalTurn } from "../types";
import { pickAnswer } from "../pick-answer";
import { Button } from "@/components/ui/button";
import { DetailSheet } from "./DetailSheet";

export function AnswerBubble({ turn }: { turn: RetrievalTurn }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="flex flex-col gap-1.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Cosimi
      </div>
      {turn.status === "loading" && (
        <div className="text-sm text-muted-foreground" aria-label="Retrieving">
          …
        </div>
      )}
      {turn.status === "error" && <div className="text-sm text-destructive">{turn.message}</div>}
      {turn.status === "done" &&
        (() => {
          const answer = pickAnswer(turn.result);
          if (answer === null)
            return <div className="text-sm text-muted-foreground">Nothing relevant found.</div>;
          return (
            <div className="flex flex-col items-start gap-2">
              <div className="whitespace-pre-wrap break-words">{answer}</div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                Details
              </Button>
              <DetailSheet open={open} result={turn.result} onOpenChange={setOpen} />
            </div>
          );
        })()}
    </article>
  );
}
