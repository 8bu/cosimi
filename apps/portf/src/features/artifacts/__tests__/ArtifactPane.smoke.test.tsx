import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: vi.fn(), history: { back: vi.fn() } }),
  useRouterState: (arg?: { select?: (s: { location: { pathname: string } }) => string }) =>
    arg?.select ? arg.select({ location: { pathname: "/chat/abc" } }) : "/chat/abc",
}));

afterEach(() => {
  cleanup();
});

describe("<ArtifactPane> smoke (real MDX)", () => {
  it("renders a real fixture descriptor end-to-end", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");
    // Use a single explicit fixture path to avoid hitting the error fixtures
    // (duplicate-slug.mdx and mismatched-kind.mdx both throw at _buildCatalog).
    const mods = import.meta.glob("../../../artifacts/__fixtures__/projects/sample-project.mdx", {
      eager: true,
    });
    const catalog = _buildCatalog(mods as never);
    // Pick the first (and only) descriptor.
    const descriptor = Array.from(catalog.values())[0];
    if (!descriptor) throw new Error("catalog built no descriptors from the fixture glob");

    const { ArtifactPane } = await import("@/features/artifacts/components/ArtifactPane");
    const { container } = render(<ArtifactPane descriptor={descriptor} />);

    // The pane chrome renders the kicker; the kicker contains the descriptor title.
    expect(container.querySelector(".artifact-kicker")?.textContent ?? "").toContain(
      descriptor.title,
    );
    // The per-kind body wrapper must be present.
    const body = container.querySelector(`.artifact-body.is-${descriptor.kind}`);
    expect(body).toBeTruthy();
    // The MDX body must have actually compiled and mounted (non-empty content).
    expect((body?.textContent ?? "").length).toBeGreaterThan(0);
  });
});
