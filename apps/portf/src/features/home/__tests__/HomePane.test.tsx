import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { SuggestionChip } from "../data";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

// Pin the sampled chips so HomePane tests are deterministic (the live hook
// shuffles a random 5 from a ~50-chip pool on mount).
const FIXED_CHIPS = [
  { mark: "🚀", label: "Best project" },
  { mark: "🧰", label: "Tech stack" },
  { mark: "🤝", label: "Why hire you" },
  { mark: "☕", label: "Coffee chat" },
  { mark: "🗓️", label: "Available for hire" },
] as unknown as ReadonlyArray<SuggestionChip>;

vi.mock("../use-sampled-chips", () => ({
  useSampledChips: () => FIXED_CHIPS,
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
        fireEvent.click(screen.getByRole("button", { name: /Tech stack/ }));
        // Advance one char's worth of typing.
        await vi.advanceTimersByTimeAsync(40);
      });
      expect(input.value.length).toBeGreaterThan(0);
      expect("Tech stack").toContain(input.value);
    } finally {
      vi.useRealTimers();
    }
  });
});
