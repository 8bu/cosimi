import { describe, expect, it } from "vitest";
import { estimateTokens } from "./tokens";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("grows with text length (monotonic for appended content)", () => {
    const short = estimateTokens("hello world");
    const long = estimateTokens("hello world this is a much longer sentence with more tokens");
    expect(long).toBeGreaterThan(short);
  });

  it("counts a realistic sentence in a sane range", () => {
    const n = estimateTokens("The quick brown fox jumps over the lazy dog.");
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(20);
  });

  it("handles Vietnamese diacritics without throwing", () => {
    expect(estimateTokens("Xin chào, bạn khỏe không?")).toBeGreaterThan(0);
  });
});
