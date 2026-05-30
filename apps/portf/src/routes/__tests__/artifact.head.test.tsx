import { describe, it, expect } from "vitest";
import { Route } from "@/routes/artifact.$kind.$slug";
import type { ArtifactDescriptor } from "@/features/artifacts/types";

const fakeDescriptor: ArtifactDescriptor = {
  kind: "projects",
  slug: "wegopro",
  title: "WegoPro",
  kicker: "WEGOPRO.COM",
  period: "2022–2026",
  stack: ["TypeScript", "Vue 3"],
  summary: "B2B corporate travel platform.",
  thumb: null,
  matchPatterns: [],
  locale: "en",
  order: 0,
  url: undefined,
  repo: undefined,
  Component: () => null,
};

describe("/artifact/$kind/$slug head()", () => {
  it("emits catalog-driven title + og:image + canonical", () => {
    // head() re-resolves the descriptor from the catalog using params.slug,
    // so the test exercises the real catalog (wegopro is a known descriptor).
    void fakeDescriptor;
    const headFn = Route.options.head;
    expect(headFn).toBeDefined();
    const result = headFn!({
      params: { kind: "projects", slug: "wegopro" },
      matches: [],
      match: {} as never,
    } as never) as {
      meta?: Array<Record<string, unknown>>;
      links?: Array<Record<string, unknown>>;
    };
    const titleMeta = result.meta?.find((m) => "title" in m);
    expect(titleMeta).toEqual({ title: "WegoPro - projects | Long NGUYỄN" });
    const ogImage = result.meta?.find((m) => m.property === "og:image");
    expect(ogImage).toEqual({ property: "og:image", content: "/og/wegopro.png" });
    const canonical = result.links?.find((l) => l.rel === "canonical");
    expect(canonical).toEqual({
      rel: "canonical",
      href: "https://8bu.dev/artifact/projects/wegopro",
    });
  });
});
