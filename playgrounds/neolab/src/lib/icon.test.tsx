import { render } from "@testing-library/react";
import { Icon } from "@/lib/icon";

test("renders an svg with the requested size + 1.6 stroke", () => {
  const { container } = render(<Icon name="search" size={20} />);
  const svg = container.querySelector("svg")!;
  expect(svg).toBeInTheDocument();
  expect(svg.getAttribute("width")).toBe("20");
  expect(svg.getAttribute("stroke-width")).toBe("1.6");
});
