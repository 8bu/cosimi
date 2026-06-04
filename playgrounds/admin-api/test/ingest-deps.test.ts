import { afterEach, beforeEach, expect, it } from "vitest";
import { buildIngestDeps } from "../src/lib/ingest-deps";

const SAVED = { ...process.env };
afterEach(() => {
  process.env = { ...SAVED };
});
beforeEach(() => {
  process.env.EMBEDDING_DIM = "1024";
});

it("throws when the api key is empty", () => {
  expect(() => buildIngestDeps("")).toThrow(/api key/i);
});

it("assembles deps with a 1024-dim embedder and both LLMs when a key is provided", () => {
  const deps = buildIngestDeps("sk-test-key");
  expect(deps.embedder.dimension).toBe(1024);
  expect(typeof deps.generateLLM.complete).toBe("function");
  expect(typeof deps.auditLLM.complete).toBe("function");
  expect(typeof deps.documents.create).toBe("function");
  expect(typeof deps.mapChunkToPair).toBe("function");
});
