import { useState } from "react";
import { usePairs } from "@/api/pairs";
import { useDebounced } from "@/lib/use-debounced";
import { Pagination } from "@/components/Pagination";
import { PairsFilters, type Filters } from "./PairsFilters";
import { PairRow } from "./PairRow";

const PAGE_SIZE = 50;

const initialFilters: Filters = {
  source: undefined,
  topic: "",
  q: "",
  includeDeleted: false,
};

export function PairsView() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(0);

  // Debounce only the free-text inputs (q, topic) — both fire a query
  // per keystroke otherwise. Source + includeDeleted use intentional
  // clicks and should refetch immediately.
  const debouncedQ = useDebounced(filters.q, 250);
  const debouncedTopic = useDebounced(filters.topic, 250);

  const { data, isLoading } = usePairs({
    source: filters.source,
    topic: debouncedTopic || undefined,
    q: debouncedQ || undefined,
    include_deleted: filters.includeDeleted,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const items = data?.items ?? [];

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-medium">Pairs</h1>
        <p className="text-sm text-muted-foreground">
          The entire learned corpus. Search, edit, soft-delete, restore.
        </p>
      </header>

      <PairsFilters
        value={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(0);
        }}
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Input</th>
              <th className="px-3 py-2 font-medium">Response</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Topic</th>
              <th className="px-3 py-2 font-medium text-right">Score</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <PairRow key={p.id} pair={p} />
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(page > 0 || items.length === PAGE_SIZE) && (
        <Pagination page={page} hasMore={items.length === PAGE_SIZE} onChange={setPage} />
      )}
    </section>
  );
}
