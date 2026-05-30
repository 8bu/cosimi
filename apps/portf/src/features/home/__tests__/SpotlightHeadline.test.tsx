import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpotlightHeadline } from "../components/SpotlightHeadline";

describe("SpotlightHeadline", () => {
  it("renders the headline phrase", () => {
    render(<SpotlightHeadline />);
    expect(screen.getByText(/Long NGUYỄN/)).toBeInTheDocument();
    expect(screen.getByText(/What would you like/)).toBeInTheDocument();
  });

  it("renders the sub-line", () => {
    render(<SpotlightHeadline />);
    expect(screen.getByText(/Senior Web Developer/)).toBeInTheDocument();
  });

  it("applies the v2-headline class", () => {
    const { container } = render(<SpotlightHeadline />);
    expect(container.querySelector(".v2-headline")).not.toBeNull();
    expect(container.querySelector(".v2-sub")).not.toBeNull();
  });
});
