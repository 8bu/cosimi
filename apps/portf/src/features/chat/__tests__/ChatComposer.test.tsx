import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { sendMock, queueNextMock, state } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  queueNextMock: vi.fn(),
  state: {
    streamingByThread: {} as Record<string, true>,
    queuedByThread: {} as Record<string, string>,
  },
}));

interface MockStore {
  send: typeof sendMock;
  queueNext: typeof queueNextMock;
  streamingByThread: Record<string, true>;
  queuedByThread: Record<string, string>;
}

vi.mock("@/store/messages", () => ({
  useMessagesStore: Object.assign(
    (sel: (s: MockStore) => unknown) =>
      sel({
        send: sendMock,
        queueNext: queueNextMock,
        streamingByThread: state.streamingByThread,
        queuedByThread: state.queuedByThread,
      }),
    {
      getState: () => ({
        send: sendMock,
        queueNext: queueNextMock,
        streamingByThread: state.streamingByThread,
        queuedByThread: state.queuedByThread,
      }),
    },
  ),
}));

describe("ChatComposer", () => {
  beforeEach(() => {
    sendMock.mockReset();
    queueNextMock.mockReset();
    state.streamingByThread = {};
    state.queuedByThread = {};
  });

  it("autofocuses the input on mount", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    expect(document.activeElement?.tagName).toBe("INPUT");
  });

  it("submits via form onSubmit and calls messages.send when idle", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ping" } });
    fireEvent.submit(input.closest("form")!);
    expect(sendMock).toHaveBeenCalledWith("t1", "ping");
    expect(queueNextMock).not.toHaveBeenCalled();
  });

  it("does not submit empty input", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const form = screen.getByRole("textbox").closest("form")!;
    fireEvent.submit(form);
    expect(sendMock).not.toHaveBeenCalled();
    expect(queueNextMock).not.toHaveBeenCalled();
  });

  it("disables send button when input empty", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const btn = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("input stays ENABLED while streaming (visitor can draft a follow-up)", async () => {
    state.streamingByThread = { t1: true };
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("submit during streaming calls queueNext (not send) when queue empty", async () => {
    state.streamingByThread = { t1: true };
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "follow-up" } });
    fireEvent.submit(input.closest("form")!);
    expect(queueNextMock).toHaveBeenCalledWith("t1", "follow-up");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("send button is DISABLED when streaming AND queue slot is already full", async () => {
    state.streamingByThread = { t1: true };
    state.queuedByThread = { t1: "already queued" };
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "second one" } });
    const btn = screen.getByRole("button", { name: /queue/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // And the form submit guard refuses too
    fireEvent.submit(input.closest("form")!);
    expect(queueNextMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("renders the queued-hint preview when a queue item exists", async () => {
    state.streamingByThread = { t1: true };
    state.queuedByThread = { t1: "what about Nuxt 4?" };
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    const { container } = render(<ChatComposer threadId="t1" />);
    expect(container.querySelector(".composer-queue-hint")).toBeTruthy();
    expect(container.textContent).toContain("what about Nuxt 4?");
  });

  it("send button label changes to 'Queue' during streaming", async () => {
    state.streamingByThread = { t1: true };
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const btn = screen.getByRole("button", { name: /queue/i }) as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("Queue");
  });
});
