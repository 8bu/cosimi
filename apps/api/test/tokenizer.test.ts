import { describe, expect, it } from "vitest";

import { jitterMs, tokenize } from "../src/lib/tokenizer";

describe("tokenize", () => {
  it("yields one Unicode code-point per chunk in char mode", () => {
    expect([...tokenize("hi đ!", "char")]).toEqual(["h", "i", " ", "đ", "!"]);
  });

  it("splits on whitespace runs in token mode, preserving runs", () => {
    expect([...tokenize("hello   world", "token")]).toEqual(["hello", "   ", "world"]);
  });

  it("round-trips by concatenation (token mode is lossless)", () => {
    const src = "  hello\n\tworld  ";
    expect([...tokenize(src, "token")].join("")).toBe(src);
  });

  it("yields nothing for empty input in either mode", () => {
    expect([...tokenize("", "char")]).toEqual([]);
    expect([...tokenize("", "token")]).toEqual([]);
  });
});

describe("jitterMs", () => {
  it("returns base exactly when jitter is 0", () => {
    expect(jitterMs(50, 0)).toBe(50);
    expect(jitterMs(0, 0)).toBe(0);
  });

  it("returns a value in [max(0, base-jitter), base+jitter]", () => {
    for (let i = 0; i < 200; i++) {
      const v = jitterMs(30, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(50);
    }
  });

  it("clamps at 0 when base - jitter would go negative", () => {
    for (let i = 0; i < 50; i++) {
      expect(jitterMs(5, 100)).toBeGreaterThanOrEqual(0);
    }
  });
});
