import { expect, it, vi } from "vitest";
import { createWorkersAiEmbedder } from "../src/index";

it("calls ai.run with model + text array and maps data → vectors", async () => {
  const run = vi.fn(async () => ({
    data: [
      [1, 2, 3],
      [4, 5, 6],
    ],
  }));
  const e = createWorkersAiEmbedder({ ai: { run }, dimension: 3 });
  const out = await e.embed(["a", "b"]);
  expect(out).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
  expect(run).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith("@cf/baai/bge-m3", { text: ["a", "b"] });
});

it("defaults dimension to 1024 and model to @cf/baai/bge-m3", async () => {
  const run = vi.fn(async () => ({ data: [[0]] }));
  const e = createWorkersAiEmbedder({ ai: { run } });
  expect(e.dimension).toBe(1024);
  await e.embed(["x"]);
  expect(run).toHaveBeenCalledWith("@cf/baai/bge-m3", { text: ["x"] });
});

it("returns [] for an empty batch without calling the binding", async () => {
  const run = vi.fn(async () => ({ data: [] as number[][] }));
  const e = createWorkersAiEmbedder({ ai: { run } });
  expect(await e.embed([])).toEqual([]);
  expect(run).not.toHaveBeenCalled();
});

it("propagates a binding rejection", async () => {
  const run = vi.fn(async () => {
    throw new Error("AI binding boom");
  });
  const e = createWorkersAiEmbedder({ ai: { run } });
  await expect(e.embed(["a"])).rejects.toThrow(/AI binding boom/);
});
