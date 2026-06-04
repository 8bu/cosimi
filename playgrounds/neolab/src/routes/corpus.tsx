import { createFileRoute } from "@tanstack/react-router";
import { CorpusBrowser } from "@/features/corpus/components/CorpusBrowser";
import { useDocuments } from "@/features/documents/hooks";

function CorpusPage() {
  const { data: docs = [] } = useDocuments();
  const { doc, chunk } = Route.useSearch();
  return <CorpusBrowser docs={docs} initialDoc={doc} initialChunk={chunk} />;
}

export const Route = createFileRoute("/corpus")({
  validateSearch: (s: Record<string, unknown>): { doc?: string; chunk?: string } => ({
    doc: typeof s.doc === "string" ? s.doc : undefined,
    chunk: typeof s.chunk === "string" ? s.chunk : undefined,
  }),
  component: CorpusPage,
});
