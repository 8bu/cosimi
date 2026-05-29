import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

describe("ArtifactPanel chrome + behaviors", () => {
  afterEach(cleanup);

  it("renders kicker prefixed with ↗ glyph", async () => {
    const { ArtifactPanel } = await import("@/features/artifacts/components/ArtifactPanel");
    render(
      <ArtifactPanel kicker="ARTIFACT · WEGOPRO" title="WegoPro" onClose={() => {}}>
        body
      </ArtifactPanel>,
    );
    const kicker = document.querySelector(".artifact-kicker");
    expect(kicker?.textContent).toBe("↗ ARTIFACT · WEGOPRO");
  });

  it("auto-focuses the section on mount so Esc works without manual tab-in", async () => {
    const { ArtifactPanel } = await import("@/features/artifacts/components/ArtifactPanel");
    render(
      <ArtifactPanel kicker="K" title="T" onClose={() => {}}>
        body
      </ArtifactPanel>,
    );
    const section = document.querySelector(".artifact-pane") as HTMLElement;
    expect(document.activeElement).toBe(section);
  });

  it("Esc on focused section invokes onClose", async () => {
    const { ArtifactPanel } = await import("@/features/artifacts/components/ArtifactPanel");
    const onClose = vi.fn();
    render(
      <ArtifactPanel kicker="K" title="T" onClose={onClose}>
        body
      </ArtifactPanel>,
    );
    const section = document.querySelector(".artifact-pane") as HTMLElement;
    fireEvent.keyDown(section, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("× click invokes onClose", async () => {
    const { ArtifactPanel } = await import("@/features/artifacts/components/ArtifactPanel");
    const onClose = vi.fn();
    render(
      <ArtifactPanel kicker="K" title="T" onClose={onClose}>
        body
      </ArtifactPanel>,
    );
    const close = document.querySelector(".artifact-close") as HTMLElement;
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("← BACK click invokes onClose", async () => {
    const { ArtifactPanel } = await import("@/features/artifacts/components/ArtifactPanel");
    const onClose = vi.fn();
    render(
      <ArtifactPanel kicker="K" title="T" onClose={onClose}>
        body
      </ArtifactPanel>,
    );
    const back = document.querySelector(".artifact-back") as HTMLElement;
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
