import { expect, it } from "vitest";
import type { RetrievalResult } from "@/lib/api/types";
import { pickAnswer } from "./pick-answer";

const pairHit = (response: string) => ({
  kind: "pair" as const,
  similarity: 1,
  input: "q",
  response,
  context: [],
});
const chunkHit = (content: string) => ({
  kind: "chunk" as const,
  similarity: 0.9,
  chunk: { id: "c", documentId: "d", content, sectionTitle: null, hops: 0, similarity: 0.9 },
  pairs: [],
});

it("returns the top pair-hit response", () => {
  const r: RetrievalResult = { hits: [pairHit("30 days"), chunkHit("ignored")] };
  expect(pickAnswer(r)).toBe("30 days");
});
it("returns the top chunk-hit content when a chunk ranks first", () => {
  const r: RetrievalResult = { hits: [chunkHit("the chunk content")] };
  expect(pickAnswer(r)).toBe("the chunk content");
});
it("null on no hits", () => {
  expect(pickAnswer({ hits: [] })).toBeNull();
});
