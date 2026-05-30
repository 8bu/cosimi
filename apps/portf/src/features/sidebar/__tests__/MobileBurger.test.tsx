import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { toggleMock } = vi.hoisted(() => ({ toggleMock: vi.fn() }));

vi.mock("@/store/ui", () => ({
  useUiStore: Object.assign(
    (sel: (s: { toggleSidebar: typeof toggleMock }) => unknown) =>
      sel({ toggleSidebar: toggleMock }),
    { getState: () => ({ toggleSidebar: toggleMock }) },
  ),
}));

describe("MobileBurger", () => {
  it("calls toggleSidebar on click", async () => {
    const { MobileBurger } = await import("@/features/sidebar/components/MobileBurger");
    render(<MobileBurger />);
    fireEvent.click(screen.getByLabelText(/open thread list/i));
    expect(toggleMock).toHaveBeenCalledOnce();
  });
});
