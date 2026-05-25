import type { UserMsg } from "@/features/chat/types";

export function UserMessage({ msg }: { msg: UserMsg }) {
  return (
    <article className="flex flex-col gap-1.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        You
      </div>
      <div className="prose-chat text-foreground whitespace-pre-wrap break-words">{msg.text}</div>
    </article>
  );
}
