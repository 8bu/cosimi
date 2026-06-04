import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHead } from "@/components/shell/PageHead";
import { Stat } from "@/components/shell/Stat";
import { EmptyPane } from "@/components/shell/atoms";
import { useFallback } from "@/features/fallback/hooks";
import { FallbackList, type SourceFilter } from "@/features/fallback/components/FallbackList";

type FallbackSearch = { source: SourceFilter };

function FallbackPage() {
  const { source } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading } = useFallback(source);
  const misses = data ?? [];

  return (
    <div className="scroll">
      <div className="page">
        <PageHead
          kicker="Manage / Fallback"
          title="Retrieval fallbacks"
          sub="Queries that returned no confident match. Curate them — author a doc, add a Q/A pair, or fix the source — to close the gap."
        />

        <div className="stats">
          <Stat k="Open misses" v={misses.length} />
          <Stat k="Affected queries" v="—" />
          <Stat k="Avg best score" v="—" />
          <Stat k="Resolved (7d)" v="—" />
        </div>

        {isLoading ? (
          <div className="kicker" style={{ padding: "24px 0" }}>
            Loading…
          </div>
        ) : misses.length === 0 ? (
          <EmptyPane
            icon="layers"
            title="No misses yet"
            desc="Queries that return no confident match will collect here for curation."
          />
        ) : (
          <FallbackList
            misses={misses}
            source={source}
            onSource={(s) => navigate({ to: "/fallback", search: { source: s } })}
            onTest={(q) => navigate({ to: "/retrieve", search: { q, run: true } })}
            onIngest={() => navigate({ to: "/ingest" })}
          />
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/fallback")({
  validateSearch: (s: Record<string, unknown>): FallbackSearch => ({
    source: (s.source as SourceFilter) ?? "all",
  }),
  component: FallbackPage,
});
