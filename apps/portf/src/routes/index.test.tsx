import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "@/components/Wordmark";
import { PortfShell } from "@/components/PortfShell";

describe("PortfShell smoke", () => {
  it("renders the Wordmark inside the PortfShell", () => {
    render(
      <PortfShell>
        <Wordmark size={16} sub="Senior Web Developer" />
      </PortfShell>,
    );

    // Block-cursor wordmark renders "8BU" badge + the wm-text.
    expect(screen.getByText("8BU", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Long NGUYỄN")).toBeInTheDocument();
    expect(screen.getByText(/Senior Web Developer/)).toBeInTheDocument();
  });

  it("omits the subtitle when sub is null", () => {
    render(<Wordmark size={16} sub={null} />);

    expect(screen.getByText("Long NGUYỄN")).toBeInTheDocument();
    expect(screen.queryByText(/Senior Web Developer/)).toBeNull();
  });

  it("PortfShell renders a frame container", () => {
    const { container } = render(
      <PortfShell>
        <span data-testid="child" />
      </PortfShell>,
    );

    const shell = container.querySelector("[data-portf-shell]");
    expect(shell).not.toBeNull();
    expect(shell?.classList.contains("frame")).toBe(true);
    expect(shell?.classList.contains("frame-desktop")).toBe(true);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
