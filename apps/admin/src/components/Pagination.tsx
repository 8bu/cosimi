import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  page: number; // zero-indexed
  hasMore: boolean; // caller computes (e.g. items.length === PAGE_SIZE)
  onChange: (next: number) => void;
}

/**
 * Minimal prev/next pagination. We don't know the total row count
 * (admin-api list routes return `{ items, limit, offset }` without a
 * total — adding COUNT(*) would be a second seq-scan). The caller owns
 * the "has-next" decision (typically `items.length === PAGE_SIZE`)
 * because some lists may want different heuristics (e.g. server
 * eventually returns a `next_cursor` token).
 *
 * False positive: when the result count is an exact multiple of
 * PAGE_SIZE, Next is enabled and the next page renders empty. Acceptable
 * — the empty-state cell still communicates the boundary.
 */
export function Pagination({ page, hasMore, onChange }: Props) {
  const hasPrev = page > 0;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <span className="text-muted-foreground">Page {page + 1}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPrev}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
