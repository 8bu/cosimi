import type { RelatedChunk } from "@/lib/api/types";

export function ChunkCard({ chunk }: { chunk: RelatedChunk }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-xs">
        {chunk.sectionTitle && <span className="font-medium">{chunk.sectionTitle}</span>}
        <span className="text-muted-foreground">
          {Math.round(chunk.similarity * 100)}% similarity
        </span>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {chunk.hops === 0 ? "source" : `${chunk.hops} hops`}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{chunk.content}</p>
    </div>
  );
}
