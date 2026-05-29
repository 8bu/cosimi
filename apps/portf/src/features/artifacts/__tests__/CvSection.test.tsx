import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

describe("CvSection", () => {
  afterEach(cleanup);

  it("renders col=left with cv-section is-left class", async () => {
    const { CvSection } = await import("@/features/artifacts/components/bodies/CvSection");
    const { container } = render(<CvSection col="left">x</CvSection>);
    const el = container.querySelector(".cv-section.is-left");
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe("x");
  });

  it("renders col=right with cv-section is-right class", async () => {
    const { CvSection } = await import("@/features/artifacts/components/bodies/CvSection");
    const { container } = render(<CvSection col="right">y</CvSection>);
    const el = container.querySelector(".cv-section.is-right");
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe("y");
  });
});
