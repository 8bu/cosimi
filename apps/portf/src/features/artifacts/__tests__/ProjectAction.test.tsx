import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

function d(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "x",
    title: "X",
    kicker: "open artifact",
    period: "2025",
    stack: [],
    summary: "",
    thumb: null,
    matchPatterns: ["x"],
    locale: "en",
    order: 0,
    Component: () => null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("<ProjectAction> multi-action", () => {
  it("renders nothing when neither url nor repo present", async () => {
    const { ProjectAction } = await import("@/features/artifacts/components/actions/ProjectAction");
    const { container } = render(<ProjectAction descriptor={d()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders single live-url CTA when only url present", async () => {
    const { ProjectAction } = await import("@/features/artifacts/components/actions/ProjectAction");
    render(<ProjectAction descriptor={d({ url: "https://wegopro.com" })} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    const [primary] = links as [HTMLAnchorElement];
    expect(primary.getAttribute("href")).toBe("https://wegopro.com");
    expect(primary.textContent).toContain("wegopro.com");
  });

  it("renders single repo CTA when only repo present", async () => {
    const { ProjectAction } = await import("@/features/artifacts/components/actions/ProjectAction");
    render(<ProjectAction descriptor={d({ repo: "https://github.com/8bu/x" })} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    const [only] = links as [HTMLAnchorElement];
    expect(only.getAttribute("href")).toBe("https://github.com/8bu/x");
    expect(only.textContent).toContain("github.com/8bu/x");
  });

  it("renders both CTAs stacked when both present (live-url first, repo second)", async () => {
    const { ProjectAction } = await import("@/features/artifacts/components/actions/ProjectAction");
    render(
      <ProjectAction
        descriptor={d({ url: "https://wegopro.com", repo: "https://github.com/8bu/x" })}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    const [primary, secondary] = links as [HTMLAnchorElement, HTMLAnchorElement];
    expect(primary.getAttribute("href")).toBe("https://wegopro.com");
    expect(secondary.getAttribute("href")).toBe("https://github.com/8bu/x");
  });
});
