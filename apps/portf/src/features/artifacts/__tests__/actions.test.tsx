import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

function d(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "x",
    title: "t",
    kicker: "k",
    period: "2026",
    stack: [],
    summary: "",
    thumb: null,
    matchPatterns: ["xx"],
    locale: "en",
    order: 0,
    Component: () => null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("<ProjectAction>", () => {
  it("renders external link with hostname when url present", async () => {
    const { ProjectAction } = await import("@/features/artifacts/components/actions/ProjectAction");
    const { container } = render(<ProjectAction descriptor={d({ url: "https://wegopro.com" })} />);
    const link = container.querySelector("a.artifact-action") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toBe("https://wegopro.com/");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.textContent).toContain("wegopro.com");
  });

  it("renders null when descriptor.url is undefined", async () => {
    const { ProjectAction } = await import("@/features/artifacts/components/actions/ProjectAction");
    const { container } = render(<ProjectAction descriptor={d()} />);
    expect(container.querySelector("a.artifact-action")).toBeNull();
  });
});

describe("<EssayAction>", () => {
  it("renders nothing (essays have no per-item CTA)", async () => {
    const { EssayAction } = await import("@/features/artifacts/components/actions/EssayAction");
    const { container } = render(<EssayAction />);
    expect(container.querySelector("a.artifact-action")).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});

describe("<CvAction>", () => {
  it("renders download anchor when descriptor.url present", async () => {
    const { CvAction } = await import("@/features/artifacts/components/actions/CvAction");
    const { container } = render(
      <CvAction descriptor={d({ kind: "resume", url: "/longnguyen-2026.pdf" })} />,
    );
    const link = container.querySelector("a.artifact-action") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/longnguyen-2026.pdf");
    expect(link.hasAttribute("download")).toBe(true);
    expect(link.textContent).toContain(".PDF");
  });

  it("renders null when descriptor.url is undefined", async () => {
    const { CvAction } = await import("@/features/artifacts/components/actions/CvAction");
    const { container } = render(<CvAction descriptor={d({ kind: "resume" })} />);
    expect(container.querySelector("a.artifact-action")).toBeNull();
  });
});
