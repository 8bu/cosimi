import { createFileRoute } from "@tanstack/react-router";
import { FallbackList } from "@/features/fallback/components/FallbackList";

export const Route = createFileRoute("/fallback")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Fallback — retrieval misses</h1>
      <p className="text-sm text-muted-foreground">
        Queries that returned nothing, logged from /retrieve. Review-only for now.
      </p>
      <FallbackList />
    </div>
  ),
});
