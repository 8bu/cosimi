import { describe, expect, it } from "vitest";

import { normalize } from "@cosimi/normalizer";

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

  describe("destylize: collapse stylized letter-spacing", () => {
    it("collapses dash-separated single letters", () => {
      expect(normalize("B-A-S-E-D")).toBe("based");
      expect(normalize("F-B-I")).toBe("fbi");
    });

    it("collapses space-separated single letters", () => {
      expect(normalize("B A S E D")).toBe("based");
      expect(normalize("f b i")).toBe("fbi");
    });

    it("collapses single letters with mixed dash + space separators", () => {
      expect(normalize("B-A S-E-D")).toBe("based");
    });

    it("collapses multi-space separated single letters via prior whitespace collapse", () => {
      expect(normalize("B   A   S   E   D")).toBe("based");
    });

    it("does NOT collapse multi-char tokens like x-ray or well-known", () => {
      expect(normalize("x-ray")).toBe("x-ray");
      expect(normalize("well-known")).toBe("well-known");
    });

    it("only collapses the stretched run, leaving surrounding text intact", () => {
      expect(normalize("yo b-a-s-e-d bro")).toBe("yo based bro");
      expect(normalize("that's sus l-o-l")).toBe("that's sus lol");
    });

    it("leaves non-stylized inputs unchanged", () => {
      expect(normalize("based")).toBe("based");
      expect(normalize("hello world")).toBe("hello world");
    });
  });
});
