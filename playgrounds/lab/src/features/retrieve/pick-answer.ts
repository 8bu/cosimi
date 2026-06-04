import type { RetrievalResult } from "@/lib/api/types";

/**
 * The demo's "answer": the top-ranked hit. A pair-hit answers with its
 * `response`; a chunk-hit answers with its `content`. null when there are no hits.
 */
export function pickAnswer(result: RetrievalResult): string | null {
  const top = result.hits[0];
  if (!top) return null;
  return top.kind === "pair" ? top.response : top.chunk.content;
}
