import { createFileRoute } from "@tanstack/react-router";
import { TuningPanel } from "@/features/retrieve/components/TuningPanel";
import { ThreadList } from "@/features/retrieve/components/ThreadList";
import { QueryComposer } from "@/features/retrieve/components/QueryComposer";

export const Route = createFileRoute("/")({
  component: RetrievePage,
});

function RetrievePage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Retrieve</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic retrieval over the ingested corpus. The top pair is the answer; open Details
          for the full ranked chunk graph.
        </p>
      </div>
      <TuningPanel />
      <div className="flex-1 overflow-y-auto rounded-xl border bg-muted/20 px-4">
        <ThreadList />
      </div>
      <QueryComposer />
    </div>
  );
}
