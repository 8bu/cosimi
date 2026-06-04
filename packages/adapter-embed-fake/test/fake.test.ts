import { expect, it } from "vitest";
import { createFakeEmbedder } from "../src/index";

it("reports its dimension and returns vectors of that length", async () => {
  const e = createFakeEmbedder(8);
  expect(e.dimension).toBe(8);
  const [v] = await e.embed(["hello"]);
  expect(v).toHaveLength(8);
});

it("defaults to 1024 dimensions", () => {
  expect(createFakeEmbedder().dimension).toBe(1024);
});

it("is deterministic — same text → same vector", async () => {
  const e = createFakeEmbedder(16);
  const [a] = await e.embed(["cat"]);
  const [b] = await e.embed(["cat"]);
  expect(a).toEqual(b);
});

it("different texts → different vectors", async () => {
  const e = createFakeEmbedder(16);
  const [a] = await e.embed(["cat"]);
  const [b] = await e.embed(["dog"]);
  expect(a).not.toEqual(b);
});

it("preserves batch order", async () => {
  const e = createFakeEmbedder(16);
  const vecs = await e.embed(["a", "b", "c"]);
  expect(vecs).toHaveLength(3);
  const solo = await e.embed(["b"]);
  expect(vecs[1]).toEqual(solo[0]);
});
