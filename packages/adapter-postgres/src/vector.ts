// pgvector's text I/O format is a bracketed, comma-separated list: `[1,2,3]`.
// postgres.js has no native vector codec, so the adapter serializes on write
// (`${toVector(v)}::vector`) and parses on read.

/** number[] → pgvector literal (`[1,2,3]`). Bind with an explicit `::vector` cast. */
export function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** pgvector literal (or null) → number[] (or null). */
export function fromVector(s: string | null): number[] | null {
  if (s === null) return null;
  const inner = s.slice(1, -1); // strip [ ]
  if (inner.length === 0) return [];
  return inner.split(",").map(Number);
}
