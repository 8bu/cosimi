import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@/store/messages", () => ({
  useMessagesStore: Object.assign(
    (sel: (s: { send: typeof sendMock }) => unknown) => sel({ send: sendMock }),
    { getState: () => ({ send: sendMock }) },
  ),
}));

describe("ChatComposer", () => {
  beforeEach(() => {
    sendMock.mockReset();
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
});
