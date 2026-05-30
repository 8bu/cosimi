import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MessageBubble } from "@/features/chat/components/MessageBubble";
import type { ChatMessage } from "@/features/chat/types";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

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
  artifactSlug: null,
  createdAt: 0,
};

const botSettled: ChatMessage = {
  kind: "bot",
  id: "b2",
  text: "pong",
  status: "settled",
  meta: null,
  noMatch: false,
  artifactSlug: null,
  createdAt: 0,
};

const botError: ChatMessage = {
  kind: "bot",
  id: "b3",
  text: "partial",
  status: "error",
  meta: null,
  noMatch: false,
  artifactSlug: null,
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

describe("MessageBubble artifact preview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.doUnmock("@/features/artifacts/catalog");
  });

  it("renders ArtifactPreviewCard when artifactSlug resolves in catalog", async () => {
    vi.doMock("@/features/artifacts/catalog", () => ({
      getDescriptor: vi.fn(() => ({
        kind: "projects",
        slug: "wegopro",
        title: "WegoPro",
        kicker: "open artifact",
        period: "2022–2026",
        stack: ["Nuxt"],
        summary: "",
        thumb: null,
        matchPatterns: ["wegopro"],
        locale: "en",
        order: 0,
        Component: () => null,
      })),
    }));

    const { MessageBubble: Fresh } = await import("@/features/chat/components/MessageBubble");

    const bot: ChatMessage = {
      kind: "bot",
      id: "b1",
      text: "Probably WegoPro - 4 years on B2B travel.",
      status: "settled",
      meta: { tier: "exact", confidence: 1, lowConfidence: false, locale: "en", topic: null },
      noMatch: false,
      artifactSlug: "wegopro",
      createdAt: 1,
    };

    render(<Fresh message={bot} />);
    expect(screen.getByText("WegoPro · 2022–2026")).toBeTruthy();
    expect(screen.getByText(/tap to open it on the right/i)).toBeTruthy();
  });

  it("does not render card when artifactSlug is null", async () => {
    const { MessageBubble: Fresh } = await import("@/features/chat/components/MessageBubble");

    const bot: ChatMessage = {
      kind: "bot",
      id: "b1",
      text: "Hello.",
      status: "settled",
      meta: null,
      noMatch: false,
      artifactSlug: null,
      createdAt: 1,
    };

    render(<Fresh message={bot} />);
    expect(screen.queryByText(/tap to open it on the right/i)).toBeNull();
  });

  it("does not render card when artifactSlug set but catalog returns null", async () => {
    vi.doMock("@/features/artifacts/catalog", () => ({
      getDescriptor: vi.fn(() => null),
    }));

    const { MessageBubble: Fresh } = await import("@/features/chat/components/MessageBubble");

    const bot: ChatMessage = {
      kind: "bot",
      id: "b1",
      text: "...",
      status: "settled",
      meta: null,
      noMatch: false,
      artifactSlug: "ghost-slug-no-mdx",
      createdAt: 1,
    };

    render(<Fresh message={bot} />);
    expect(screen.queryByText(/tap to open it on the right/i)).toBeNull();
  });

  it("clicking card calls navigate with to='.' and artifact search param", async () => {
    const navigateMock = vi.fn();

    vi.doMock("@tanstack/react-router", () => ({
      useNavigate: () => navigateMock,
    }));

    vi.doMock("@/features/artifacts/catalog", () => ({
      getDescriptor: vi.fn(() => ({
        kind: "projects",
        slug: "wegopro",
        title: "WegoPro",
        kicker: "open artifact",
        period: "2022–2026",
        stack: ["Nuxt"],
        summary: "",
        thumb: null,
        matchPatterns: ["wegopro"],
        locale: "en",
        order: 0,
        Component: () => null,
      })),
    }));

    const { MessageBubble: Fresh } = await import("@/features/chat/components/MessageBubble");

    const bot: ChatMessage = {
      kind: "bot",
      id: "b1",
      text: "Probably WegoPro.",
      status: "settled",
      meta: { tier: "exact", confidence: 1, lowConfidence: false, locale: "en", topic: null },
      noMatch: false,
      artifactSlug: "wegopro",
      createdAt: 1,
    };

    render(<Fresh message={bot} />);
    fireEvent.click(screen.getByRole("button", { name: /open artifact: wegopro/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const rawCall = navigateMock.mock.calls[0] as unknown as [{ to: string; search: unknown }];
    const call = rawCall[0];
    expect(call.to).toBe(".");
    const searchResult =
      typeof call.search === "function"
        ? (call.search as (prev: Record<string, unknown>) => Record<string, unknown>)({})
        : call.search;
    expect(searchResult).toEqual({ artifact: "wegopro" });
  });
});
