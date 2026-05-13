import { describe, expect, it } from "vitest";

import { normalize } from "@simlm/normalizer";

describe("normalize", () => {
  it("lowercases while preserving diacritics (Vietnamese)", () => {
    expect(normalize("Xin chào!")).toBe("xin chào!");
  });

  it("preserves đ — Postgres handles đ→d via f_unaccent later", () => {
    expect(normalize("Cô đi học.")).toBe("cô đi học.");
  });

  it("collapses internal whitespace and trims edges", () => {
    expect(normalize("  HELLO   WORLD  ")).toBe("hello world");
  });

  it("lowercases multi-byte chars with combining marks", () => {
    expect(normalize("Đẹp trai")).toBe("đẹp trai");
  });

  it("passes plain ASCII through unchanged after lowercase + trim", () => {
    expect(normalize("hello world")).toBe("hello world");
    expect(normalize("Café 123")).toBe("café 123");
  });

  it("is idempotent: normalize(normalize(x)) === normalize(x)", () => {
    const samples = ["Xin chào!", "  HELLO   WORLD  ", "Đẹp trai", "Cô đi học.", "hello world", ""];
    for (const s of samples) {
      const once = normalize(s);
      expect(normalize(once)).toBe(once);
    }
  });

  it("returns empty string for empty input", () => {
    expect(normalize("")).toBe("");
  });
});
