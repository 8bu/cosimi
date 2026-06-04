import type { ChunkHit, PairHit, RetrievalResult } from "@/lib/api/raw-types";
import type { HitVM, RetrieveVM } from "./view-models";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Client-side `<mark>` highlight: wrap ≥3-char query terms in the (escaped) text. */
export function highlight(text: string, query: string): string {
  const safe = escapeHtml(text);
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 3),
    ),
  );
  if (terms.length === 0) return safe;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return safe.replace(re, "<mark>$1</mark>");
}

type DocTitleFn = (docId: string) => string | null;

function pairHitToVM(hit: PairHit, rank: number, docTitle: DocTitleFn, query: string): HitVM {
  const source = hit.context.find((c) => c.hops === 0) ?? hit.context[0];
  const docId = source?.documentId ?? "";
  return {
    rank,
    kind: "pair",
    score: hit.similarity,
    docId,
    docTitle: docId ? docTitle(docId) : null,
    chunkId: source?.id ?? null,
    text: highlight(source?.content ?? hit.response, query),
    page: null,
    vec: hit.similarity,
    lex: null,
    answer: hit.response,
    neighbors: hit.context
      .filter((c) => c.hops > 0)
      .map((c) => ({ id: c.id, text: c.content, page: null })),
    pairs: [{ q: hit.input, a: hit.response }],
  };
}

function chunkHitToVM(hit: ChunkHit, rank: number, docTitle: DocTitleFn, query: string): HitVM {
  return {
    rank,
    kind: "chunk",
    score: hit.similarity,
    docId: hit.chunk.documentId,
    docTitle: docTitle(hit.chunk.documentId),
    chunkId: hit.chunk.id,
    text: highlight(hit.chunk.content, query),
    page: null,
    vec: hit.similarity,
    lex: null,
    answer: null,
    neighbors: [],
    pairs: hit.pairs.map((p) => ({ q: p.input, a: p.response })),
  };
}

/**
 * Map the deterministic backend result to the workbench view-model. The grounded
 * answer = the top hit's pre-generated pair `response` (no runtime LLM); absent
 * when the top hit is a chunk-hit.
 */
export function toRetrieveVM(
  query: string,
  result: RetrievalResult,
  docTitle: DocTitleFn,
  tookMs: number | null,
): RetrieveVM {
  const hits: HitVM[] = result.hits.map((h, i) =>
    h.kind === "pair"
      ? pairHitToVM(h, i + 1, docTitle, query)
      : chunkHitToVM(h, i + 1, docTitle, query),
  );
  const top = result.hits[0];
  const answer = top && top.kind === "pair" ? { text: top.response, cite: 1 } : null;
  return { query, tookMs, hits, answer };
}
