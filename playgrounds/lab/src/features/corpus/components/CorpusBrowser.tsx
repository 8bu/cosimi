import { useEffect, useState } from "react";
import { useCorpusDocuments, useChunks, useChunkPairs } from "../hooks";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function CorpusBrowser({ initialDoc = null }: { initialDoc?: string | null }) {
  const [doc, setDoc] = useState<string | null>(initialDoc);
  const [chunk, setChunk] = useState<string | null>(null);
  const docs = useCorpusDocuments();
  const chunks = useChunks(doc);
  const pairs = useChunkPairs(chunk);
  const selectedChunk = chunks.data?.find((c) => c.id === chunk) ?? null;

  // Auto-select the first chunk when a document's chunks load, so the pairs
  // pane is populated without an extra click.
  useEffect(() => {
    if (doc && chunks.data && chunks.data.length > 0) setChunk((c) => c ?? chunks.data![0]!.id);
  }, [doc, chunks.data]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Pane title="Documents">
        {docs.data?.map((d) => (
          <Row
            key={d.id}
            active={d.id === doc}
            onClick={() => {
              setDoc(d.id);
              setChunk(null);
            }}
          >
            {d.title} <span className="text-muted-foreground">({d.chunkCount})</span>
          </Row>
        ))}
      </Pane>
      <Pane title="Chunks">
        {doc ? (
          chunks.data?.map((c) => (
            <Row key={c.id} active={c.id === chunk} onClick={() => setChunk(c.id)}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">#{c.chunk_index}</span>
                <span className="font-medium">{c.section_title ?? "—"}</span>
                {!c.has_embedding && (
                  <Badge variant="outline" className="text-[10px]">
                    no embed
                  </Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.content}</p>
            </Row>
          ))
        ) : (
          <Empty>Pick a document</Empty>
        )}
      </Pane>
      <Pane title="Chunk & Pairs">
        {selectedChunk && (
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Full chunk content
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedChunk.content}</p>
          </div>
        )}
        {chunk ? (
          pairs.data?.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-1 rounded-md border bg-background p-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {p.audit_status}
                </Badge>
                <span className="truncate text-xs text-muted-foreground">{p.input}</span>
              </div>
              <div>{p.response}</div>
            </div>
          ))
        ) : (
          <Empty>Pick a chunk</Empty>
        )}
      </Pane>
    </div>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="flex max-h-[68vh] flex-col gap-1.5 overflow-y-auto p-2">{children}</div>
    </Card>
  );
}
function Row({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${active ? "border-primary bg-primary/5 text-foreground" : "border-transparent hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
