import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { navigateMock, createMock, setSidebarOpenMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  createMock: vi.fn(() => "new-thread-id"),
  setSidebarOpenMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/store/threads", () => ({
  useThreadsStore: Object.assign(
    (sel: (s: { create: typeof createMock }) => unknown) => sel({ create: createMock }),
    { getState: () => ({ create: createMock }) },
  ),
}));

vi.mock("@/store/ui", () => ({
  useUiStore: Object.assign(
    (sel: (s: { setSidebarOpen: typeof setSidebarOpenMock }) => unknown) =>
      sel({ setSidebarOpen: setSidebarOpenMock }),
    { getState: () => ({ setSidebarOpen: setSidebarOpenMock }) },
  ),
}));

describe("NewChatButton", () => {
  it("mints a thread, closes drawer, and navigates", async () => {
    const { NewChatButton } = await import("@/features/sidebar/components/NewChatButton");
    render(<NewChatButton />);
    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));
    expect(createMock).toHaveBeenCalled();
    expect(setSidebarOpenMock).toHaveBeenCalledWith(false);
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/chat/$threadId",
      params: { threadId: "new-thread-id" },
      search: { artifact: undefined },
    });
  });
});
