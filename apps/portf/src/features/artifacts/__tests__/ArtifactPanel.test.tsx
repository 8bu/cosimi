import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

describe("<ArtifactPanel>", () => {
  async function load() {
    const mod = await import("@/features/artifacts/components/ArtifactPanel");
    return mod.ArtifactPanel;
  }

  it("renders kicker, title, meta", async () => {
    const ArtifactPanel = await load();
    render(
      <ArtifactPanel kicker="ARTIFACT · WEGOPRO" title="WegoPro" meta="x" onClose={() => {}}>
        <div data-testid="body">body</div>
      </ArtifactPanel>,
    );
    expect(screen.getByText("↗ ARTIFACT · WEGOPRO")).toBeTruthy();
    expect(screen.getByText("WegoPro")).toBeTruthy();
    expect(screen.getByText("x")).toBeTruthy();
    expect(screen.getByTestId("body")).toBeTruthy();
  });

  it("renders action slot when provided", async () => {
    const ArtifactPanel = await load();
    render(
      <ArtifactPanel
        kicker="k"
        title="t"
        onClose={() => {}}
        action={<button data-testid="action">go</button>}
      >
        <div />
      </ArtifactPanel>,
    );
    expect(screen.getByTestId("action")).toBeTruthy();
  });

  it("calls onClose on × button click (desktop)", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <div />
      </ArtifactPanel>,
    );
    const close = container.querySelector(".artifact-close") as HTMLElement;
    expect(close).toBeTruthy();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on ← BACK click (mobile)", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <div />
      </ArtifactPanel>,
    );
    const back = container.querySelector(".artifact-back") as HTMLElement;
    expect(back).toBeTruthy();
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Esc keydown when focused on pane", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <div />
      </ArtifactPanel>,
    );
    const pane = container.querySelector(".artifact-pane") as HTMLElement;
    fireEvent.keyDown(pane, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Esc when focus is in an input", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <input data-testid="i" />
      </ArtifactPanel>,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not render meta line when meta prop omitted", async () => {
    const ArtifactPanel = await load();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={() => {}}>
        <div />
      </ArtifactPanel>,
    );
    expect(container.querySelector(".artifact-panel-meta")).toBeNull();
  });

  it("does not render .artifact-chrome-actions when action prop omitted", async () => {
    const ArtifactPanel = await load();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={() => {}}>
        <div />
      </ArtifactPanel>,
    );
    expect(container.querySelector(".artifact-chrome-actions")).toBeNull();
  });

  it("× span activates on Enter key", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <div />
      </ArtifactPanel>,
    );
    const close = container.querySelector(".artifact-close") as HTMLElement;
    fireEvent.keyDown(close, { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("× span activates on Space key", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <div />
      </ArtifactPanel>,
    );
    const close = container.querySelector(".artifact-close") as HTMLElement;
    fireEvent.keyDown(close, { key: " " });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("← BACK span activates on Enter key", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <div />
      </ArtifactPanel>,
    );
    const back = container.querySelector(".artifact-back") as HTMLElement;
    fireEvent.keyDown(back, { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("← BACK span activates on Space key", async () => {
    const ArtifactPanel = await load();
    const onClose = vi.fn();
    const { container } = render(
      <ArtifactPanel kicker="k" title="t" onClose={onClose}>
        <div />
      </ArtifactPanel>,
    );
    const back = container.querySelector(".artifact-back") as HTMLElement;
    fireEvent.keyDown(back, { key: " " });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
