export function QueryBubble({ query }: { query: string }) {
  return (
    <article className="flex flex-col gap-1.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        You
      </div>
      <div className="whitespace-pre-wrap break-words">{query}</div>
    </article>
  );
}
