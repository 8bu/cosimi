import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  page: number; // zero-indexed
  pageSize: number;
  itemCount: number; // items currently on screen (not total — admin-api doesn't return total)
  onPageChange: (next: number) => void;
}

/**
 * Minimal prev/next pagination. We don't know the total row count
 * (admin-api's /unanswered returns `{ items, limit, offset }` without a
 * total — adding COUNT(*) would be a second seq-scan on the unanswered
 * table). "Has-next" is inferred from `itemCount === pageSize`: a full
 * page implies there might be more, an underfilled page is the end.
 *
 * False positive: when the result count is an exact multiple of pageSize,
 * Next is enabled and the next page renders empty. Acceptable — the
 * empty-state cell ("No rows.") still communicates the boundary.
 */
export function Pagination({ page, pageSize, itemCount, onPageChange }: Props) {
  const hasPrev = page > 0;
  const hasNext = itemCount === pageSize;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <span className="text-muted-foreground">Page {page + 1}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPrev}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
