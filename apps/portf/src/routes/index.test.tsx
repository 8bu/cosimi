import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "@/components/Wordmark";
import { AppShell } from "@/components/AppShell";

describe("HomePane smoke", () => {
  it("renders the Wordmark inside the AppShell", () => {
    render(
      <AppShell>
        <Wordmark size={16} sub="Senior Web Developer" />
      </AppShell>,
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

  it("AppShell renders a frame container", () => {
    const { container } = render(
      <AppShell>
        <span data-testid="child" />
      </AppShell>,
    );

    const shell = container.querySelector("[data-portf-shell]");
    expect(shell).not.toBeNull();
    expect(shell?.classList.contains("frame")).toBe(true);
    expect(shell?.classList.contains("frame-desktop")).toBe(true);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
