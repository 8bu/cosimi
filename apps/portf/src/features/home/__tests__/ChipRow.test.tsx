import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChipRow } from "../components/ChipRow";
import type { SuggestionChip } from "../data";

// ChipRow is presentational - render it with a fixed fixture so the test is
// independent of the (large, randomly-sampled) live pool.
const FIXTURE = [
  { mark: "🚀", label: "Best project" },
  { mark: "🧰", label: "Tech stack" },
  { mark: "🤝", label: "Why hire you" },
] as unknown as ReadonlyArray<SuggestionChip>;

describe("ChipRow", () => {
  it("renders one button per chip with mark + label", () => {
    render(<ChipRow chips={FIXTURE} onPick={() => {}} />);
    for (const c of FIXTURE) {
      const btn = screen.getByRole("button", { name: new RegExp(c.label) });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain(c.mark);
    }
  });

  it("fires onPick with the chip label on click", () => {
    const onPick = vi.fn();
    render(<ChipRow chips={FIXTURE} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Best project/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("Best project");
  });

  it("applies the .chips wrapper and .chip class", () => {
    const { container } = render(<ChipRow chips={FIXTURE} onPick={() => {}} />);
    expect(container.querySelector(".chips")).not.toBeNull();
    expect(container.querySelectorAll(".chip")).toHaveLength(FIXTURE.length);
  });
});
