import type { RetrievalHit, RetrievalResult } from "@/lib/api/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChunkCard } from "./ChunkCard";

export function DetailSheet({
  open,
  result,
  onOpenChange,
}: {
  open: boolean;
  result: RetrievalResult;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Retrieved sources</SheetTitle>
          <SheetDescription className="sr-only">
            Ranked retrieval hits and context.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 p-4">
          {result.hits.map((hit, i) => (
            <HitCard key={i} hit={hit} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HitCard({ hit }: { hit: RetrievalHit }) {
  if (hit.kind === "pair") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">pair</span>
          <span className="text-muted-foreground">{Math.round(hit.similarity * 100)}% match</span>
        </div>
        <div className="text-xs font-medium text-muted-foreground">{hit.input}</div>
        <div className="text-sm">{hit.response}</div>
        {hit.context.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Context
            </span>
            {hit.context.map((c) => (
              <ChunkCard key={c.id} chunk={c} />
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">chunk</span>
        <span className="text-muted-foreground">{Math.round(hit.similarity * 100)}% match</span>
      </div>
      <ChunkCard chunk={hit.chunk} />
      {hit.pairs.length > 0 && (
        <ul className="flex flex-col gap-1">
          {hit.pairs.map((p, i) => (
            <li key={i} className="rounded-md border bg-background px-3 py-2 text-sm">
              <div className="text-xs font-medium text-muted-foreground">{p.input}</div>
              <div>{p.response}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
