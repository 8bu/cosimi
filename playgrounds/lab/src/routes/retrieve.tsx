import { createFileRoute } from "@tanstack/react-router";
import { useDocuments } from "@/features/documents/hooks";
import { RetrieveWorkbench } from "@/features/retrieve/components/RetrieveWorkbench";
import { RetrieveSheet } from "@/features/retrieve/components/RetrieveSheet";

interface RetrieveSearch {
  q: string | undefined;
  run: boolean;
}

function RetrievePage() {
  const search = Route.useSearch();
  const { data: docs = [] } = useDocuments();

  return (
    <>
      <RetrieveWorkbench presetQuery={search.q} autoRun={search.run} docs={docs} />
      <RetrieveSheet docs={docs} />
    </>
  );
}

export const Route = createFileRoute("/retrieve")({
  validateSearch: (s: Record<string, unknown>): RetrieveSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
    run: s.run === true || s.run === "true",
  }),
  component: RetrievePage,
});
