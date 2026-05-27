import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChipRow } from "../components/ChipRow";
import { SUGGESTION_CHIPS } from "../data";

describe("ChipRow", () => {
  it("renders one button per chip with mark + label", () => {
    render(<ChipRow chips={SUGGESTION_CHIPS} onPick={() => {}} />);
    for (const c of SUGGESTION_CHIPS) {
      const btn = screen.getByRole("button", { name: new RegExp(c.label) });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain(c.mark);
    }
  });

  it("fires onPick with the chip label on click", () => {
    const onPick = vi.fn();
    render(<ChipRow chips={SUGGESTION_CHIPS} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Best project/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("Best project");
  });

  it("applies the .chips wrapper and .chip class", () => {
    const { container } = render(<ChipRow chips={SUGGESTION_CHIPS} onPick={() => {}} />);
    expect(container.querySelector(".chips")).not.toBeNull();
    expect(container.querySelectorAll(".chip")).toHaveLength(SUGGESTION_CHIPS.length);
  });
});
