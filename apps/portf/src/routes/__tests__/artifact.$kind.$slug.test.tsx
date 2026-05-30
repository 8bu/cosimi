import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (config: unknown) => ({ ...(config as object) }),
  notFound: () => {
    const e = new Error("NOT_FOUND");
    (e as Error & { tag?: string }).tag = "notFound";
    return e;
  },
  useRouter: () => ({ navigate: vi.fn(), history: { back: vi.fn() } }),
  useRouterState: () => "/artifact/projects/wegopro",
}));

const getDescriptor = vi.fn();
vi.mock("@/features/artifacts/catalog", () => ({
  getDescriptor: (slug: string) => getDescriptor(slug),
}));

afterEach(() => {
  cleanup();
  getDescriptor.mockReset();
});

function fakeDescriptor(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "wegopro",
    title: "WegoPro",
    kicker: "k",
    period: "2022–2026",
    stack: ["TS"],
    summary: "s",
    thumb: null,
    matchPatterns: ["xx"],
    locale: "en",
    order: 0,
    Component: () => <p data-testid="mdx-body">mdx</p>,
    ...overrides,
  };
}

describe("/artifact/$kind/$slug route", () => {
  it("loader returns descriptor when kind matches", async () => {
    const d = fakeDescriptor();
    getDescriptor.mockReturnValueOnce(d);
    const { Route } = await import("@/routes/artifact.$kind.$slug");
    const result = (Route as unknown as { loader: (a: unknown) => unknown }).loader({
      params: { kind: "projects", slug: "wegopro" },
    });
    expect(result).toEqual({ kind: d.kind, slug: d.slug });
  });

  it("loader throws notFound when descriptor is missing", async () => {
    getDescriptor.mockReturnValueOnce(null);
    const { Route } = await import("@/routes/artifact.$kind.$slug");
    expect(() =>
      (Route as unknown as { loader: (a: unknown) => unknown }).loader({
        params: { kind: "projects", slug: "missing" },
      }),
    ).toThrow();
  });

  it("loader throws notFound on kind mismatch", async () => {
    getDescriptor.mockReturnValueOnce(fakeDescriptor({ kind: "projects" }));
    const { Route } = await import("@/routes/artifact.$kind.$slug");
    expect(() =>
      (Route as unknown as { loader: (a: unknown) => unknown }).loader({
        params: { kind: "essays", slug: "wegopro" },
      }),
    ).toThrow();
  });
});
