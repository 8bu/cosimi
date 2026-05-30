import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/store/messages", () => {
  const state: {
    byThread: Record<string, unknown[]>;
    streamingByThread: Record<string, true>;
    queuedByThread: Record<string, string>;
    queueNext: () => void;
  } = { byThread: {}, streamingByThread: {}, queuedByThread: {}, queueNext: () => {} };
  const useStore = (sel: (s: typeof state) => unknown) => sel(state);
  useStore.getState = () => state;
  useStore.setState = (next: Partial<typeof state>) => Object.assign(state, next);
  return { useMessagesStore: useStore };
});

vi.mock("@/store/ui", () => {
  const state = { isSidebarOpen: false, toggleSidebar: vi.fn(), setSidebarOpen: vi.fn() };
  const useStore = (sel: (s: typeof state) => unknown) => sel(state);
  useStore.getState = () => state;
  return { useUiStore: useStore };
});

describe("ChatPane", () => {
  beforeEach(async () => {
    // jsdom doesn't implement scrollTo; stub so MessageList's useEffect
    // doesn't throw when messages are present.
    Element.prototype.scrollTo = vi.fn() as unknown as Element["scrollTo"];
    const { useMessagesStore } = await import("@/store/messages");
    useMessagesStore.setState({ byThread: {} });
  });

  it("renders EmptyChatPane when byThread[id] is empty", async () => {
    const { ChatPane } = await import("@/features/chat/components/ChatPane");
    render(<ChatPane threadId="t1" />);
    expect(screen.getByText(/ask me anything/i)).toBeInTheDocument();
  });

  it("renders MessageList when byThread[id] has messages", async () => {
    const { useMessagesStore } = await import("@/store/messages");
    useMessagesStore.setState({
      byThread: {
        t1: [{ kind: "user", id: "u1", text: "hello", createdAt: 0 }],
      },
    });
    const { ChatPane } = await import("@/features/chat/components/ChatPane");
    render(<ChatPane threadId="t1" />);
    expect(screen.queryByText(/ask me anything/i)).not.toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("includes a mobile-topbar wrapping a burger slot", async () => {
    const { ChatPane } = await import("@/features/chat/components/ChatPane");
    const { container } = render(<ChatPane threadId="t1" />);
    expect(container.querySelector(".mobile-topbar")).not.toBeNull();
  });
});
