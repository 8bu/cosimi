import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useFeedback } from "@/api/feedback";
import { useChat } from "@/features/chat/store";
import type { BotMsg } from "@/features/chat/types";

export function VoteButtons({ msg }: { msg: BotMsg }) {
  const setVote = useChat((s) => s.setVote);
  const fb = useFeedback();
  const pairId = msg.meta?.pairId;
  if (!pairId) return null;

  const submit = (value: 1 | -1) => {
    // Optimistic: paint the icon immediately; revert to 0 on error.
    setVote(msg.id, value);
    fb.mutate(
      { pair_id: pairId, value },
      {
        onError: () => setVote(msg.id, 0),
      },
    );
  };

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => submit(1)}
        aria-pressed={msg.vote === 1}
        aria-label="Upvote"
        className={`p-1 rounded ${
          msg.vote === 1 ? "text-success" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ThumbsUp className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => submit(-1)}
        aria-pressed={msg.vote === -1}
        aria-label="Downvote"
        className={`p-1 rounded ${
          msg.vote === -1 ? "text-destructive" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ThumbsDown className="size-4" />
      </button>
    </div>
  );
}
