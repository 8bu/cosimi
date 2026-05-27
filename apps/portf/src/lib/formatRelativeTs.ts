/**
 * Render a millisecond-epoch timestamp as a compact relative string:
 *   "now"  (< 60s),  "Nm"  (< 1h),  "Nh"  (< 1d),  "Nd"  (otherwise)
 *
 * Used by sidebar `.v1-thread-meta` slot. `now` defaulted to `Date.now()`
 * for production reads; tests pass a frozen value to remove clock
 * dependence.
 */
export function formatRelativeTs(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}
