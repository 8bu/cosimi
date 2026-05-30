import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Loading placeholder block. Per the shadcn-style customization model,
 * this is a per-app copy (not extracted to @cosimi/ui-tokens) so each
 * SPA can tweak it without affecting the other. The implementation is
 * intentionally tiny — a muted background + Tailwind's animate-pulse.
 * Reduced-motion users get a static block via the global override in
 * @cosimi/ui-tokens (clamps animation duration to ~0).
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} {...props} />;
}

/**
 * Convenience: a block of N table rows, useful in the brief moment
 * before a list query resolves. Caller specifies the column count so
 * the skeleton matches the surrounding table's structure.
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b last:border-0">
          {Array.from({ length: cols }).map((__, ci) => (
            <td key={ci} className="px-3 py-3">
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
