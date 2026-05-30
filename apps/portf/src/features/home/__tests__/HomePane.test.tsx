import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("HomePane", () => {
  it("renders headline, composer, chips, and hint line", async () => {
    const { HomePane } = await import("../components/HomePane");
    render(<HomePane />);

    expect(screen.getByText(/What would you like/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Best project/ })).toBeInTheDocument();
    expect(screen.getByText(/show me your CV/)).toBeInTheDocument();
  });

  it("chip click types into the composer (visible after a tick)", async () => {
    vi.useFakeTimers();
    try {
      const { HomePane } = await import("../components/HomePane");
      await act(async () => {
        render(<HomePane />);
      });
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Stack/ }));
        // Advance one char's worth of typing.
        await vi.advanceTimersByTimeAsync(40);
      });
      expect(input.value.length).toBeGreaterThan(0);
      expect("Stack").toContain(input.value);
    } finally {
      vi.useRealTimers();
    }
  });
});
