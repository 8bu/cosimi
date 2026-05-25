import type { TeachMsg } from "@/features/chat/types";

export function TeachMessage({ msg }: { msg: TeachMsg }) {
  return (
    <article className="flex flex-col gap-1.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-teach">
        You · teaching
      </div>
      <div className="font-mono text-sm text-muted-foreground bg-muted/70 border border-border rounded-md px-3 py-2 whitespace-pre-wrap break-words">
        {msg.raw}
      </div>
    </article>
  );
}
