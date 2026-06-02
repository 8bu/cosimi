import { relativeTime } from "@/lib/time";

/**
 * Wraps `relativeTime()` as a stateless component so JSX call sites read
 * naturally (`<RelativeTime when={row.last_seen} />`). Re-renders only
 * when the `when` prop changes — there's no live tick. If "1m ago" → "2m
 * ago" freshness ever matters, lift to a periodic refetch on the parent
 * query, not a per-component timer.
 */
export function RelativeTime({ when }: { when: string | number | Date }) {
  return <>{relativeTime(when)}</>;
}
