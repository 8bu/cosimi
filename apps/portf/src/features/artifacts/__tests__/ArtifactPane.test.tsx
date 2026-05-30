import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

const back = vi.fn();
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate, history: { back } }),
  useRouterState: (arg?: { select?: (s: { location: { pathname: string } }) => string }) =>
    arg?.select ? arg.select({ location: { pathname: "/chat/abc" } }) : "/chat/abc",
}));

function d(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "x",
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
    url: "https://wegopro.com",
    ...overrides,
  };
}

beforeEach(() => {
  back.mockReset();
  navigate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("<ArtifactPane>", () => {
  it("renders project kicker, project body, and project action", async () => {
    const { ArtifactPane } = await import("@/features/artifacts/components/ArtifactPane");
    const { container } = render(<ArtifactPane descriptor={d()} />);
    expect(screen.getByText("↗ ARTIFACT · WegoPro · 2022–2026")).toBeTruthy();
    expect(container.querySelector(".artifact-body.is-projects")).toBeTruthy();
    expect(container.querySelector("a.artifact-action")?.getAttribute("href")).toBe(
      "https://wegopro.com",
    );
    expect(screen.getByTestId("mdx-body")).toBeTruthy();
  });

  it("renders essay kicker + essay body + empty essay action slot", async () => {
    const { ArtifactPane } = await import("@/features/artifacts/components/ArtifactPane");
    const { container } = render(
      <ArtifactPane descriptor={d({ kind: "essays", title: "Migration", period: "04 · 2026" })} />,
    );
    expect(screen.getByText("↗ ESSAY · 04 · 2026")).toBeTruthy();
    expect(container.querySelector(".artifact-body.is-essays")).toBeTruthy();
    // EssayAction returns null - RSS dropped, no per-item CTA for essays.
    expect(container.querySelector("a.artifact-action")).toBeNull();
  });

  it("renders cv kicker + cv body + cv action when url set", async () => {
    const { ArtifactPane } = await import("@/features/artifacts/components/ArtifactPane");
    const { container } = render(
      <ArtifactPane
        descriptor={d({
          kind: "resume",
          title: "longnguyen-2026.pdf",
          period: "12 days ago",
          url: "/longnguyen-2026.pdf",
        })}
      />,
    );
    expect(screen.getByText("↗ CV · longnguyen-2026.pdf · UPDATED 12 days ago")).toBeTruthy();
    expect(container.querySelector(".artifact-body.is-resume")).toBeTruthy();
    const link = container.querySelector("a.artifact-action") as HTMLAnchorElement;
    expect(link.hasAttribute("download")).toBe(true);
  });

  it("renders misc kicker (bare title) + generic body + no action", async () => {
    const { ArtifactPane } = await import("@/features/artifacts/components/ArtifactPane");
    const { container } = render(
      <ArtifactPane descriptor={d({ kind: "misc", title: "Thing", url: undefined })} />,
    );
    // misc kicker = bare title (now glyph-prefixed); panel title still bare.
    expect(screen.getAllByText("Thing").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector(".artifact-kicker")?.textContent).toBe("↗ Thing");
    expect(container.querySelector(".artifact-body.is-misc")).toBeTruthy();
    expect(container.querySelector("a.artifact-action")).toBeNull();
  });

  it("× button click triggers router.history.back()", async () => {
    const { ArtifactPane } = await import("@/features/artifacts/components/ArtifactPane");
    const { container } = render(<ArtifactPane descriptor={d()} />);
    const close = container.querySelector(".artifact-close") as HTMLElement;
    fireEvent.click(close);
    expect(back).toHaveBeenCalledTimes(1);
  });
});
