import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "./vec";

describe("cosineSimilarity", () => {
  it("is 1 for identical direction", () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1, 5);
  });
  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
  it("is -1 for opposite direction", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });
  it("returns 0 when either vector is all zeros", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
