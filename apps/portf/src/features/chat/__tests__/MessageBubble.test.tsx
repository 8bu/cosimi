import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/features/chat/components/MessageBubble";
import type { ChatMessage } from "@/features/chat/types";

const user: ChatMessage = {
  kind: "user",
  id: "u1",
  text: "hello",
  createdAt: 0,
};

const botStreaming: ChatMessage = {
  kind: "bot",
  id: "b1",
  text: "",
  status: "streaming",
  meta: null,
  noMatch: false,
  createdAt: 0,
};

const botSettled: ChatMessage = {
  kind: "bot",
  id: "b2",
  text: "pong",
  status: "settled",
  meta: null,
  noMatch: false,
  createdAt: 0,
};

const botError: ChatMessage = {
  kind: "bot",
  id: "b3",
  text: "partial",
  status: "error",
  meta: null,
  noMatch: false,
  createdAt: 0,
};

describe("MessageBubble", () => {
  it("renders user text in .bubble-user", () => {
    const { container } = render(<MessageBubble message={user} />);
    expect(container.querySelector(".bubble-user")?.textContent).toBe("hello");
  });

  it("renders typing indicator for streaming bot with empty text", () => {
    const { container } = render(<MessageBubble message={botStreaming} />);
    expect(container.querySelector(".typing-indicator")).not.toBeNull();
  });

  it("renders text for settled bot", () => {
    render(<MessageBubble message={botSettled} />);
    expect(screen.getByText("pong")).toBeInTheDocument();
  });

  it("adds is-error modifier when bot status is error", () => {
    const { container } = render(<MessageBubble message={botError} />);
    expect(container.querySelector(".bubble.is-error")).not.toBeNull();
  });
});
