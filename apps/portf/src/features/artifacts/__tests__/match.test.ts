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

  it("returns null when tier is trigram", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "fixture",
        tier: "trigram",
        primaryLocale: "en",
        catalog: [descriptor()],
      }),
    ).toBeNull();
  });

  it("returns null when tier is session_teach", async () => {
    const { matchArtifact } = await import("@/features/artifacts/match");
    expect(
      matchArtifact({
        input: "fixture",
        tier: "session_teach",
        primaryLocale: "en",
        catalog: [descriptor()],
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
});
