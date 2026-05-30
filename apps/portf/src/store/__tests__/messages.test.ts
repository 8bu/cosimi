import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatStreamEvent } from "@cosimi/types";

const { streamMock } = vi.hoisted(() => ({ streamMock: vi.fn() }));

vi.mock("@/lib/streamChat", () => ({
  streamChatPortf: streamMock,
}));

async function* genFrom(events: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  for (const e of events) yield e;
}

describe("messages store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    streamMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("send pushes user + bot placeholder and streams tokens", async () => {
    streamMock.mockReturnValue(
      genFrom([
        {
          type: "metadata",
          tier: "exact",
          confidence: 0.99,
          pairId: 1,
          score: 0,
          lowConfidence: false,
          locale: "en",
          topic: null,
        },
        { type: "token", content: "po" },
        { type: "token", content: "ng" },
        { type: "done" },
      ]),
    );
    const { useMessagesStore } = await import("@/store/messages");
    await useMessagesStore.getState().send("t1", "ping");
    const msgs = useMessagesStore.getState().byThread["t1"]!;
    expect(msgs.length).toBe(2);
    expect(msgs[0]).toMatchObject({ kind: "user", text: "ping" });
    expect(msgs[1]).toMatchObject({ kind: "bot", text: "pong", status: "settled" });
  });

  it("applies no_match: marks the bubble + fake-streams a fallback from the pool", async () => {
    streamMock.mockReturnValue(genFrom([{ type: "no_match" }, { type: "done" }]));
    vi.useFakeTimers();
    const { useMessagesStore } = await import("@/store/messages");
    const { FALLBACK_EN_POOL } = await import("@/features/chat/tokens");
    const sendPromise = useMessagesStore.getState().send("t2", "obscure");
    await vi.runAllTimersAsync();
    await sendPromise;
    // Drain the fake-stream setTimeout chain. The longest pool entry is
    // ~60 chars × ~70ms ≈ 4.2s; advance generously.
    await vi.advanceTimersByTimeAsync(10_000);
    const msgs = useMessagesStore.getState().byThread["t2"]!;
    const bot = msgs.find((m) => m.kind === "bot");
    expect(bot?.noMatch).toBe(true);
    // Text must match one of the pool entries verbatim.
    expect(FALLBACK_EN_POOL).toContain(bot?.text);
  });

  it("clear removes the thread slice", async () => {
    const { useMessagesStore } = await import("@/store/messages");
    useMessagesStore.setState({ byThread: { t3: [] } });
    useMessagesStore.getState().clear("t3");
    expect(useMessagesStore.getState().byThread["t3"]).toBeUndefined();
  });

  it("hydrate restores from localStorage", async () => {
    localStorage.setItem(
      "portf.messages",
      JSON.stringify({
        tH: [{ kind: "user", id: "u1", text: "saved", createdAt: 1 }],
      }),
    );
    const { useMessagesStore } = await import("@/store/messages");
    useMessagesStore.getState().hydrate();
    expect(useMessagesStore.getState().byThread["tH"]?.[0]?.text).toBe("saved");
  });

  it("send registers thread + touches + sets title-if-empty", async () => {
    streamMock.mockReturnValue(genFrom([{ type: "done" }]));
    const { useMessagesStore } = await import("@/store/messages");
    const { useThreadsStore } = await import("@/store/threads");
    await useMessagesStore.getState().send("tNew", "hello world");
    const row = useThreadsStore.getState().threads.find((t) => t.id === "tNew");
    expect(row?.title).toBe("hello world");
  });

  it("server error event finishes bot with error status", async () => {
    streamMock.mockReturnValue(genFrom([{ type: "error", message: "boom" }, { type: "done" }]));
    const { useMessagesStore } = await import("@/store/messages");
    await useMessagesStore.getState().send("tErr", "x");
    const bot = useMessagesStore.getState().byThread["tErr"]!.find((m) => m.kind === "bot");
    expect(bot?.status).toBe("error");
  });

  it("network throw catches and marks bot error", async () => {
    streamMock.mockImplementation(() => {
      throw new Error("net fail");
    });
    const { useMessagesStore } = await import("@/store/messages");
    await useMessagesStore.getState().send("tNet", "x");
    const bot = useMessagesStore.getState().byThread["tNet"]!.find((m) => m.kind === "bot");
    expect(bot?.status).toBe("error");
  });

  it("flushPersistNow writes to localStorage on terminal transition", async () => {
    streamMock.mockReturnValue(genFrom([{ type: "done" }]));
    const { useMessagesStore } = await import("@/store/messages");
    await useMessagesStore.getState().send("tP", "hello");
    const raw = localStorage.getItem("portf.messages");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).tP).toBeDefined();
  });
});

describe("finishBot artifact hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    streamMock.mockReset();
  });

  it("stamps artifactSlug when matchArtifact returns a descriptor (exact tier)", async () => {
    vi.doMock("@/features/artifacts/match", () => ({
      matchArtifact: vi.fn(() => ({ slug: "wegopro" })),
    }));

    const { useMessagesStore } = await import("@/store/messages");
    const threadId = "t1";

    useMessagesStore.setState({
      byThread: {
        [threadId]: [
          {
            kind: "user",
            id: "u1",
            text: "tell me about wegopro",
            createdAt: 1,
          },
          {
            kind: "bot",
            id: "b1",
            text: "Probably WegoPro - 4 years on B2B travel.",
            status: "streaming",
            meta: {
              tier: "exact",
              confidence: 0.9,
              lowConfidence: false,
              locale: "en",
              topic: null,
            },
            noMatch: false,
            artifactSlug: null,
            createdAt: 2,
          },
        ],
      },
    });

    useMessagesStore.getState().finishBot(threadId, "b1", "settled");

    const updated = useMessagesStore.getState().byThread[threadId]?.find((m) => m.id === "b1");
    expect(updated?.kind).toBe("bot");
    if (updated?.kind === "bot") {
      expect(updated.artifactSlug).toBe("wegopro");
    }
  });

  it("leaves artifactSlug null when matchArtifact returns null", async () => {
    vi.doMock("@/features/artifacts/match", () => ({
      matchArtifact: vi.fn(() => null),
    }));

    const { useMessagesStore } = await import("@/store/messages");
    const threadId = "t2";

    useMessagesStore.setState({
      byThread: {
        [threadId]: [
          { kind: "user", id: "u1", text: "unrelated", createdAt: 1 },
          {
            kind: "bot",
            id: "b1",
            text: "...",
            status: "streaming",
            meta: {
              tier: "trigram",
              confidence: 0.3,
              lowConfidence: true,
              locale: "en",
              topic: null,
            },
            noMatch: false,
            artifactSlug: null,
            createdAt: 2,
          },
        ],
      },
    });

    useMessagesStore.getState().finishBot(threadId, "b1", "settled");

    const updated = useMessagesStore.getState().byThread[threadId]?.find((m) => m.id === "b1");
    if (updated?.kind === "bot") {
      expect(updated.artifactSlug).toBeNull();
    }
  });

  it("does not run matchArtifact when status is 'error'", async () => {
    const mockMatch = vi.fn(() => ({ slug: "x" }));
    vi.doMock("@/features/artifacts/match", () => ({ matchArtifact: mockMatch }));

    const { useMessagesStore } = await import("@/store/messages");
    const threadId = "t3";

    useMessagesStore.setState({
      byThread: {
        [threadId]: [
          { kind: "user", id: "u1", text: "wegopro", createdAt: 1 },
          {
            kind: "bot",
            id: "b1",
            text: "",
            status: "streaming",
            meta: { tier: "exact", confidence: 1, lowConfidence: false, locale: "en", topic: null },
            noMatch: false,
            artifactSlug: null,
            createdAt: 2,
          },
        ],
      },
    });

    useMessagesStore.getState().finishBot(threadId, "b1", "error");

    expect(mockMatch).not.toHaveBeenCalled();
    const updated = useMessagesStore.getState().byThread[threadId]?.find((m) => m.id === "b1");
    if (updated?.kind === "bot") {
      expect(updated.artifactSlug).toBeNull();
    }
  });

  it("hydrate normalizes missing artifactSlug on bot messages to null", async () => {
    localStorage.setItem(
      "portf.messages",
      JSON.stringify({
        t1: [
          { kind: "user", id: "u1", text: "x", createdAt: 1 },
          {
            kind: "bot",
            id: "b1",
            text: "y",
            status: "settled",
            meta: null,
            noMatch: false,
            createdAt: 2,
            // artifactSlug intentionally omitted (legacy v1 blob)
          },
        ],
      }),
    );

    const { useMessagesStore } = await import("@/store/messages");
    useMessagesStore.getState().hydrate();

    const bot = useMessagesStore.getState().byThread.t1?.find((m) => m.id === "b1");
    if (bot?.kind === "bot") {
      expect(bot.artifactSlug).toBeNull();
    }
  });
});
