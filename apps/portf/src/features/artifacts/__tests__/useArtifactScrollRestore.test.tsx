import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import type { ReactElement } from "react";

describe("useArtifactScrollRestore", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  async function renderHarness(slug: string): Promise<HTMLDivElement> {
    const { useArtifactScrollRestore } =
      await import("@/features/artifacts/hooks/useArtifactScrollRestore");
    function Harness(): ReactElement {
      const ref = useArtifactScrollRestore(slug);
      return (
        <div ref={ref} data-testid="scroll-target" style={{ height: 50, overflow: "auto" }}>
          <div style={{ height: 1000 }}>tall</div>
        </div>
      );
    }
    const { findByTestId } = render(<Harness />);
    return (await findByTestId("scroll-target")) as HTMLDivElement;
  }

  it("restores scrollTop from sessionStorage on mount", async () => {
    sessionStorage.setItem("portf.artifact-scroll.wegopro", "240");
    const el = await renderHarness("wegopro");
    expect(el.scrollTop).toBe(240);
  });

  it("persists scrollTop on scroll", async () => {
    const el = await renderHarness("essay-x");
    act(() => {
      el.scrollTop = 180;
      el.dispatchEvent(new Event("scroll"));
    });
    expect(sessionStorage.getItem("portf.artifact-scroll.essay-x")).toBe("180");
  });

  it("defaults to 0 when no stored value", async () => {
    const el = await renderHarness("fresh");
    expect(el.scrollTop).toBe(0);
  });
});
