// Module-level singleton — Intl.RelativeTimeFormat is allocation-heavy
// and locale-derived (so the result is consistent across renders).
const RTF = new Intl.RelativeTimeFormat(undefined, { style: "narrow" });

/**
 * Render an absolute timestamp as "2m ago" / "in 3h" / "5d ago".
 * Threshold ladder: minutes (<60) → hours (<24) → days. Negative diffs
 * (past) and positive diffs (future) both work; Intl.RelativeTimeFormat
 * inserts the correct "ago"/"in" wording for the active locale.
 */
export function relativeTime(when: string | number | Date): string {
  const ms = new Date(when).getTime() - Date.now();
  const minutes = Math.round(ms / 60_000);
  if (Math.abs(minutes) < 60) return RTF.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RTF.format(hours, "hour");
  return RTF.format(Math.round(hours / 24), "day");
}
