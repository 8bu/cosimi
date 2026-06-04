import { afterEach, expect, it, vi } from "vitest";
import type { EmbeddingPort } from "@cosimi/core";
import { resetCorpus, seedChunk, seedDocument, seedLinkedPair, unitVec } from "./helpers";

vi.mock("../src/lib/embedder", () => ({
  resolveEmbedder: (): EmbeddingPort => ({
    dimension: 1024,
    embed: (t: string[]) => Promise.resolve(t.map(() => unitVec(0))),
  }),
  runWithAi: <T>(_ai: unknown, fn: () => T): T => fn(),
}));

const { app } = await import("../src/app");

afterEach(async () => {
  await resetCorpus();
});

it("reports documents, chunks, and embedded active pairs", async () => {
  const doc = await seedDocument();
  const chunk = await seedChunk(doc, 0, unitVec(0));
  await seedLinkedPair(chunk, "q", "a", unitVec(0));

  const res = await app.fetch(new Request("http://localhost/stats"));
  const body = (await res.json()) as { documents: number; chunks: number; pairs: number };
  expect(body.documents).toBe(1);
  expect(body.chunks).toBe(1);
  expect(body.pairs).toBe(1);
});
