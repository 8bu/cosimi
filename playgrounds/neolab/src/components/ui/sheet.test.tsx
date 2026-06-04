import { render, screen } from "@testing-library/react";
import { Sheet } from "@/components/ui/sheet";

test("renders children + title when open", () => {
  render(
    <Sheet open title="Detail" onClose={() => {}}>
      body
    </Sheet>,
  );
  expect(screen.getByText("Detail")).toBeInTheDocument();
  expect(screen.getByText("body")).toBeInTheDocument();
});

test("nothing rendered when closed", () => {
  render(
    <Sheet open={false} title="Detail" onClose={() => {}}>
      body
    </Sheet>,
  );
  expect(screen.queryByText("body")).toBeNull();
});
