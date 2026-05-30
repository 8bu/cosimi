import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("/ route", () => {
  it("renders HomePane (headline phrase + composer present)", async () => {
    const { Route } = await import("./index");
    const Component = Route.options.component!;
    render(<Component />);

    expect(screen.getByText(/What would you like/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
