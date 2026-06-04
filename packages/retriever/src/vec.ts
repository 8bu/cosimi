// pgvector's text input format is a bracketed, comma-separated list: `[1,2,3]`.
// The retriever is adapter-agnostic, so it can't import the postgres adapter's
// toVector — this is the same one-liner, kept local. Bind with `::vector`.
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
