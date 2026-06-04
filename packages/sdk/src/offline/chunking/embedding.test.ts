import { expect, it } from "vitest";
import { chunkByEmbedding } from "./embedding";
import { createScriptedEmbedder } from "../../../test/fake-embedder";

const A = "Cats purr.",
  B = "Cats nap.",
  C = "Stocks fell.",
  D = "Markets dipped.";
const vecs = new Map<string, number[]>([
  [A, [1, 0, 0]],
  [B, [0.96, 0.1, 0]],
  [C, [0, 1, 0]],
  [D, [0, 0.96, 0.1]],
]);

it("cuts at the low-similarity boundary into two chunks", async () => {
  const embedder = createScriptedEmbedder(vecs);
  const text = `${A} ${B} ${C} ${D}`;
  const nodes = await chunkByEmbedding(text, embedder, {
    chunkSplitThreshold: 0.55,
    minSentences: 1,
    splitThreshold: 600,
  });
  expect(nodes).toHaveLength(2);
  expect(nodes[0]!.content).toBe(`${A} ${B}`);
  expect(nodes[1]!.content).toBe(`${C} ${D}`);
  expect(nodes[0]!.sectionTitle).toBeNull();
});

it("merges a sub-minSentences run into its neighbor", async () => {
  const embedder = createScriptedEmbedder(
    new Map<string, number[]>([
      [A, [1, 0, 0]],
      [B, [0.96, 0, 0]],
      [C, [0, 1, 0]],
    ]),
  );
  const nodes = await chunkByEmbedding(`${A} ${B} ${C}`, embedder, {
    chunkSplitThreshold: 0.55,
    minSentences: 2,
    splitThreshold: 600,
  });
  expect(nodes).toHaveLength(1); // [A,B] kept, [C] (size 1 < 2) merged in
  expect(nodes[0]!.content).toBe(`${A} ${B} ${C}`);
});

it("returns a single chunk for one sentence", async () => {
  const embedder = createScriptedEmbedder(new Map([[A, [1, 0, 0]]]));
  const nodes = await chunkByEmbedding(A, embedder, {
    chunkSplitThreshold: 0.55,
    minSentences: 1,
    splitThreshold: 600,
  });
  expect(nodes).toEqual([{ content: A, sectionTitle: null }]);
});

it("re-splits an over-ceiling single-topic group at its weakest interior seam", async () => {
  // All three stay above the boundary (no pass-1 cut), so they form one group;
  // a tiny token ceiling forces pass-3 to split it at the weakest seam (Y↔Z,
  // cosine 0.995 < X↔Y's 0.9999).
  const X = "Alpha one.",
    Y = "Alpha two.",
    Z = "Alpha three.";
  const embedder = createScriptedEmbedder(
    new Map<string, number[]>([
      [X, [1, 0]],
      [Y, [0.99, 0.01]],
      [Z, [0.9, 0.1]],
    ]),
    2,
  );
  const nodes = await chunkByEmbedding(`${X} ${Y} ${Z}`, embedder, {
    chunkSplitThreshold: 0.55,
    minSentences: 1,
    splitThreshold: 5, // tokens; the 3-sentence join exceeds this → re-split
  });
  expect(nodes).toHaveLength(2);
  expect(nodes[0]!.content).toBe(`${X} ${Y}`);
  expect(nodes[1]!.content).toBe(Z);
});
