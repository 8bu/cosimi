import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Small "nothing here" card for views with no rows. Inline `colSpan`
 * messaging inside tables is fine for the row-count edge case; this is
 * for view-level emptiness (e.g. a feature with no items at all + a
 * call-to-action). Phase 13 keeps inline empty-state in the tables;
 * this exists for future feature reuse without inventing a new
 * primitive.
 */
export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card px-6 py-12 text-center">
      <h2 className="text-sm font-medium">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
