import { afterEach, beforeEach, expect, it } from "vitest";
import { resolveEmbedder, runWithAi } from "../src/lib/embedder";

const SAVED = { ...process.env };
afterEach(() => {
  process.env = { ...SAVED };
});
beforeEach(() => {
  process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/cosimi_test";
  process.env.EMBEDDING_DIM = "1024";
});

it("builds an ollama embedder by default with dimension = EMBEDDING_DIM", () => {
  process.env.EMBEDDER = "ollama";
  const e = resolveEmbedder();
  expect(e.dimension).toBe(1024);
});

it("requires the AI binding for workers-ai and throws without it", () => {
  process.env.EMBEDDER = "workers-ai";
  expect(() => resolveEmbedder()).toThrow(/AI binding/);
});

it("builds a workers-ai embedder when the binding is in scope via runWithAi", () => {
  process.env.EMBEDDER = "workers-ai";
  const ai = { run: async () => ({ data: [] as number[][] }) };
  const e = runWithAi(ai, () => resolveEmbedder());
  expect(e.dimension).toBe(1024);
});
