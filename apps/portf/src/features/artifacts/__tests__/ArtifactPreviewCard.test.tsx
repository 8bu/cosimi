import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

function descriptor(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "wegopro",
    title: "WegoPro",
    kicker: "open artifact",
    period: "2022–2026",
    stack: ["Nuxt", "Vue 3", "TS", "Tailwind", "AWS"],
    summary: "",
    thumb: null,
    matchPatterns: ["wegopro"],
    locale: "en",
    order: 0,
    Component: () => null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("<ArtifactPreviewCard>", () => {
  it("renders title with period", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    render(<ArtifactPreviewCard descriptor={descriptor()} onOpen={() => {}} />);
    expect(screen.getByText("WegoPro · 2022–2026")).toBeTruthy();
  });

  it("preserves en-dash in period (no replacement)", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    render(
      <ArtifactPreviewCard descriptor={descriptor({ period: "2022–2026" })} onOpen={() => {}} />,
    );
    const title = screen.getByText(/WegoPro/);
    // en-dash U+2013 must be present verbatim
    expect(title.textContent).toContain("–");
  });

  it("renders kicker text uppercase via CSS but content lowercase", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    render(
      <ArtifactPreviewCard
        descriptor={descriptor({ kicker: "open artifact" })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/open artifact/i)).toBeTruthy();
  });

  it("renders stack joined by ' · '", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    render(<ArtifactPreviewCard descriptor={descriptor()} onOpen={() => {}} />);
    expect(screen.getByText("Nuxt · Vue 3 · TS · Tailwind · AWS")).toBeTruthy();
  });

  it("renders thumb image when thumb path provided", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    const { container } = render(
      <ArtifactPreviewCard
        descriptor={descriptor({ thumb: "/img/wegopro.jpg" })}
        onOpen={() => {}}
      />,
    );
    const img = container.querySelector("img.artifact-preview-card-thumb");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/img/wegopro.jpg");
  });

  it("renders fallback thumb block (kind label) when thumb null", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    const { container } = render(
      <ArtifactPreviewCard descriptor={descriptor({ thumb: null })} onOpen={() => {}} />,
    );
    expect(container.querySelector("img.artifact-preview-card-thumb")).toBeNull();
    expect(container.querySelector(".artifact-preview-card-thumb-fallback")).toBeTruthy();
    expect(screen.getByText("PROJECTS")).toBeTruthy();
  });

  it("renders the below-card 'tap to open it on the right' hint", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    render(<ArtifactPreviewCard descriptor={descriptor()} onOpen={() => {}} />);
    expect(screen.getByText(/tap to open it on the right/i)).toBeTruthy();
  });

  it("calls onOpen with descriptor on click", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    const onOpen = vi.fn();
    const d = descriptor();
    const { container } = render(<ArtifactPreviewCard descriptor={d} onOpen={onOpen} />);
    const card = container.querySelector(".artifact-preview-card") as HTMLElement;
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(d);
  });

  it("activates on Enter key", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    const onOpen = vi.fn();
    const { container } = render(<ArtifactPreviewCard descriptor={descriptor()} onOpen={onOpen} />);
    const card = container.querySelector(".artifact-preview-card") as HTMLElement;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("activates on Space key", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    const onOpen = vi.fn();
    const { container } = render(<ArtifactPreviewCard descriptor={descriptor()} onOpen={onOpen} />);
    const card = container.querySelector(".artifact-preview-card") as HTMLElement;
    fireEvent.keyDown(card, { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does not activate on other keys", async () => {
    const { ArtifactPreviewCard } =
      await import("@/features/artifacts/components/ArtifactPreviewCard");
    const onOpen = vi.fn();
    const { container } = render(<ArtifactPreviewCard descriptor={descriptor()} onOpen={onOpen} />);
    const card = container.querySelector(".artifact-preview-card") as HTMLElement;
    fireEvent.keyDown(card, { key: "Tab" });
    fireEvent.keyDown(card, { key: "Escape" });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
