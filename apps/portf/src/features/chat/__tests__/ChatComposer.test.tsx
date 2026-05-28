import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { sendMock, state } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  state: { streamingByThread: {} as Record<string, true> },
}));

vi.mock("@/store/messages", () => ({
  useMessagesStore: Object.assign(
    (sel: (s: { send: typeof sendMock; streamingByThread: Record<string, true> }) => unknown) =>
      sel({ send: sendMock, streamingByThread: state.streamingByThread }),
    { getState: () => ({ send: sendMock, streamingByThread: state.streamingByThread }) },
  ),
}));

describe("ChatComposer", () => {
  beforeEach(() => {
    sendMock.mockReset();
    state.streamingByThread = {};
  });

  it("autofocuses the input on mount", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    expect(document.activeElement?.tagName).toBe("INPUT");
  });

  it("submits via form onSubmit and calls messages.send", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ping" } });
    fireEvent.submit(input.closest("form")!);
    expect(sendMock).toHaveBeenCalledWith("t1", "ping");
  });

  it("does not submit empty input", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const form = screen.getByRole("textbox").closest("form")!;
    fireEvent.submit(form);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("disables send button when input empty", async () => {
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const btn = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("disables input + send button while the thread is streaming", async () => {
    state.streamingByThread = { t1: true };
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const btn = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(btn.disabled).toBe(true);
  });

  it("does not submit while streaming even if value is non-empty", async () => {
    state.streamingByThread = { t1: true };
    const { ChatComposer } = await import("@/features/chat/components/ChatComposer");
    render(<ChatComposer threadId="t1" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    // input is disabled; change events still mutate state through fireEvent
    // but the form submit handler must reject due to the streaming guard.
    fireEvent.change(input, { target: { value: "ping" } });
    fireEvent.submit(input.closest("form")!);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
