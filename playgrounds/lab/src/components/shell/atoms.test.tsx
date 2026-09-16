import { render, screen } from "@testing-library/react";
import { StatusBadge, Meter, Btn } from "@/components/shell/atoms";

test("StatusBadge maps status to label", () => {
  render(<StatusBadge status="indexed" />);
  expect(screen.getByText("Indexed")).toBeInTheDocument();
});

test("Btn renders a real button with children", () => {
  render(<Btn kind="pri">Go</Btn>);
  expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
});

test("Meter bands by score", () => {
  const { container } = render(<Meter value={0.9} />);
  expect(container.querySelector(".s-hi")).toBeTruthy();
});
