import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatStreamEvent } from "@simlm/types";

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

  it("applies no_match fallback text", async () => {
    streamMock.mockReturnValue(genFrom([{ type: "no_match" }, { type: "done" }]));
    const { useMessagesStore } = await import("@/store/messages");
    const { FALLBACK_EN } = await import("@/features/chat/tokens");
    await useMessagesStore.getState().send("t2", "obscure");
    const msgs = useMessagesStore.getState().byThread["t2"]!;
    const bot = msgs.find((m) => m.kind === "bot");
    expect(bot).toMatchObject({ text: FALLBACK_EN, noMatch: true });
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
