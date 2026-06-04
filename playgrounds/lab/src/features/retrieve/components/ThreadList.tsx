import { useRetrieval } from "../store";
import { QueryBubble } from "./QueryBubble";
import { AnswerBubble } from "./AnswerBubble";

export function ThreadList() {
  const turns = useRetrieval((s) => s.turns);
  if (turns.length === 0)
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Ask a question to retrieve from the corpus.
        </p>
      </div>
    );
  return (
    <div className="flex flex-col divide-y">
      {turns.map((t) => (
        <div key={t.id}>
          <QueryBubble query={t.query} />
          <AnswerBubble turn={t} />
        </div>
      ))}
    </div>
  );
}
