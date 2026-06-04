import { createFileRoute } from "@tanstack/react-router";
import { CorpusBrowser } from "@/features/corpus/components/CorpusBrowser";

export const Route = createFileRoute("/corpus")({
  validateSearch: (s: Record<string, unknown>): { doc?: string } => ({
    doc: typeof s.doc === "string" ? s.doc : undefined,
  }),
  component: CorpusPage,
});

function CorpusPage() {
  const { doc } = Route.useSearch();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Corpus</h1>
      <CorpusBrowser initialDoc={doc ?? null} />
    </div>
  );
}
