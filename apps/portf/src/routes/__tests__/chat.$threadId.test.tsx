import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const { sendMock, navigateMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  navigateMock: vi.fn(),
}));

let mockState: { initialPrompt?: string } = {};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (cfg: unknown) => ({
    component: (cfg as { component: unknown }).component,
  }),
  useLocation: ({ select }: { select: (l: { state: { initialPrompt?: string } }) => unknown }) =>
    select({ state: mockState }),
}));

vi.mock("@/store/messages", () => ({
  useMessagesStore: Object.assign(
    (sel: (s: { send: typeof sendMock }) => unknown) => sel({ send: sendMock }),
    { getState: () => ({ send: sendMock }) },
  ),
}));

vi.mock("@/features/chat/components/ChatPane", () => ({
  ChatPane: ({ threadId }: { threadId: string }) => <div data-testid="chatpane">{threadId}</div>,
}));

describe("ChatPaneRoute", () => {
  it("sends initialPrompt exactly once on mount", async () => {
    mockState = { initialPrompt: "hello" };
    sendMock.mockReset();
    navigateMock.mockReset();
    const mod = await import("@/routes/chat.$threadId");
    const ChatPaneRoute = mod.ChatPaneRoute;
    await act(async () => {
      render(<ChatPaneRoute params={{ threadId: "t1" }} navigate={navigateMock} />);
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith("t1", "hello");
  });

  it("does not send when initialPrompt absent", async () => {
    mockState = {};
    sendMock.mockReset();
    const mod = await import("@/routes/chat.$threadId");
    const ChatPaneRoute = mod.ChatPaneRoute;
    await act(async () => {
      render(<ChatPaneRoute params={{ threadId: "tX" }} navigate={vi.fn()} />);
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
