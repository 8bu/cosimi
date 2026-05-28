import { describe, it, expect } from "vitest";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

function descriptor(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "fixture",
    title: "Fixture",
    kicker: "open artifact",
    period: "2024",
    stack: [],
    summary: "",
    thumb: null,
    matchPatterns: ["fixture"],
    locale: "en",
    order: 0,
    Component: () => null,
    ...overrides,
  };
}

describe("matchArtifact", () => {
  it("returns null when tier is null", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "fixture",
        tier: null,
        primaryLocale: "en",
        catalog: [descriptor()],
      }),
    ).toBeNull();
  });

  it("returns descriptor on trigram-tier match (loosened gate)", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const d = descriptor();
    expect(
      matchArtifact({
        input: "fixture",
        tier: "trigram",
        primaryLocale: "en",
        catalog: [d],
      }),
    ).toBe(d);
  });

  it("returns descriptor on session_teach-tier match (any non-null tier)", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const d = descriptor();
    expect(
      matchArtifact({
        input: "fixture",
        tier: "session_teach",
        primaryLocale: "en",
        catalog: [d],
      }),
    ).toBe(d);
  });

  it("reverse-matches a typo/prefix shorter than the pattern (len >= 4)", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const d = descriptor({ matchPatterns: ["wegopro"] });
    expect(
      matchArtifact({
        input: "wegopr", // 6 chars, prefix of "wegopro"
        tier: "trigram",
        primaryLocale: "en",
        catalog: [d],
      }),
    ).toBe(d);
  });

  it("does NOT reverse-match when input is shorter than 4 chars", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "weg", // 3 chars — would otherwise be substring of "wegopro"
        tier: "trigram",
        primaryLocale: "en",
        catalog: [descriptor({ matchPatterns: ["wegopro"] })],
      }),
    ).toBeNull();
  });

  it("returns descriptor on exact-tier substring match (case-insensitive)", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const d = descriptor({ matchPatterns: ["wegopro"] });
    expect(
      matchArtifact({
        input: "Tell me about WegoPro!",
        tier: "exact",
        primaryLocale: "en",
        catalog: [d],
      }),
    ).toBe(d);
  });

  it("returns descriptor on fts-tier substring match", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const d = descriptor({ matchPatterns: ["b2b travel"] });
    expect(
      matchArtifact({
        input: "what is b2b travel like",
        tier: "fts",
        primaryLocale: "en",
        catalog: [d],
      }),
    ).toBe(d);
  });

  it("returns null when input does not match any pattern", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "totally unrelated question",
        tier: "exact",
        primaryLocale: "en",
        catalog: [descriptor({ matchPatterns: ["wegopro", "vue"] })],
      }),
    ).toBeNull();
  });

  it("prefers descriptor with primaryLocale over 'en' fallback when both match", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const vi = descriptor({ slug: "vi-version", locale: "vi", matchPatterns: ["wegopro"] });
    const en = descriptor({ slug: "en-version", locale: "en", matchPatterns: ["wegopro"] });
    expect(
      matchArtifact({
        input: "wegopro",
        tier: "exact",
        primaryLocale: "vi",
        catalog: [en, vi], // intentionally en-first to verify ordering by locale, not catalog
      }),
    ).toBe(vi);
  });

  it("falls back to 'en' descriptor when no primaryLocale descriptor matches", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const en = descriptor({ slug: "en-only", locale: "en", matchPatterns: ["wegopro"] });
    expect(
      matchArtifact({
        input: "wegopro",
        tier: "exact",
        primaryLocale: "vi",
        catalog: [en],
      }),
    ).toBe(en);
  });

  it("does not double-evaluate when primaryLocale is 'en' (en-only candidate list)", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const en = descriptor({ slug: "x", locale: "en", matchPatterns: ["wegopro"] });
    expect(
      matchArtifact({
        input: "wegopro",
        tier: "exact",
        primaryLocale: "en",
        catalog: [en],
      }),
    ).toBe(en);
  });

  it("returns first match in catalog order when multiple patterns hit", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const a = descriptor({ slug: "a", matchPatterns: ["foo"] });
    const b = descriptor({ slug: "b", matchPatterns: ["foo"] });
    expect(
      matchArtifact({
        input: "foo",
        tier: "exact",
        primaryLocale: "en",
        catalog: [a, b],
      }),
    ).toBe(a);
  });

  it("ignores empty matchPatterns array (descriptor never matches)", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "anything",
        tier: "exact",
        primaryLocale: "en",
        catalog: [descriptor({ matchPatterns: [] })],
      }),
    ).toBeNull();
  });

  it("normalizes input via NFC + lowercase before substring check", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    // input uses decomposed form (e + combining acute); pattern uses precomposed
    const decomposed = "café"; // "café" with U+0301
    const d = descriptor({ matchPatterns: ["café"] });
    expect(
      matchArtifact({
        input: decomposed,
        tier: "exact",
        primaryLocale: "en",
        catalog: [d],
      }),
    ).toBe(d);
  });

  it("trims input before substring check", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    const d = descriptor({ matchPatterns: ["wegopro"] });
    expect(
      matchArtifact({
        input: "   wegopro   ",
        tier: "exact",
        primaryLocale: "en",
        catalog: [d],
      }),
    ).toBe(d);
  });

  it("returns null on empty input string", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "",
        tier: "exact",
        primaryLocale: "en",
        catalog: [descriptor()],
      }),
    ).toBeNull();
  });

  it("returns null on whitespace-only input", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "    \t  ",
        tier: "exact",
        primaryLocale: "en",
        catalog: [descriptor()],
      }),
    ).toBeNull();
  });

  describe("topic-first matching", () => {
    it("topic 'portfolio/artifact/<slug>' returns matching descriptor (bypasses matchPatterns)", async () => {
      const { matchArtifact } = await import("@/features/artifacts/match");
      // Descriptor has no matchPatterns that overlap with the input — proves
      // the topic path bypasses the matchPatterns loop entirely.
      const d = descriptor({ slug: "wegopro", matchPatterns: ["completely-unrelated-pattern"] });
      const result = matchArtifact({
        input: "b2b travel expenses at scale",
        tier: "exact",
        primaryLocale: "en",
        topic: "portfolio/artifact/wegopro",
        catalog: [d],
      });
      expect(result).toBe(d);
    });

    it("topic 'portfolio/artifact/<unknown>' returns null (catalog miss)", async () => {
      const { matchArtifact } = await import("@/features/artifacts/match");
      const d = descriptor({ slug: "wegopro", matchPatterns: ["wegopro"] });
      const result = matchArtifact({
        input: "wegopro",
        tier: "exact",
        primaryLocale: "en",
        topic: "portfolio/artifact/no-such-slug",
        catalog: [d],
      });
      expect(result).toBeNull();
    });

    it("topic 'portfolio/experience/wegopro' does NOT auto-fire (falls through to matchPatterns)", async () => {
      const { matchArtifact } = await import("@/features/artifacts/match");
      const d = descriptor({ slug: "wegopro", matchPatterns: ["wegopro"] });
      // Topic prefix is NOT "portfolio/artifact/" so it falls through to
      // matchPatterns. The input matches "wegopro", so descriptor is returned
      // (proving it reached the matchPatterns path, not the topic path).
      const result = matchArtifact({
        input: "wegopro",
        tier: "exact",
        primaryLocale: "en",
        topic: "portfolio/experience/wegopro",
        catalog: [d],
      });
      expect(result).toBe(d);
    });
  });
});
