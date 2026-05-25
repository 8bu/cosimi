import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatStreamEvent } from "@simlm/types";

// Hoisted holder for the mocked streamChat — assigned per-test to return
// a controllable async iterable. vi.mock factories run before imports, so
// they can't close over module-scope variables; use vi.hoisted.
const mocks = vi.hoisted(() => ({
  // Type-erased to keep the hoisted holder simple. The test bodies cast
  // when they need the precise type.
  streamChat: vi.fn() as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/api/chat", () => ({
  streamChat: mocks.streamChat,
}));

// Import AFTER vi.mock so the store binds to the mock.
const { useChat } = await import("@/features/chat/store");

// Hand-rolled async iterable from a plain array — mirrors what
// parseSseStream yields but without any DOM/stream setup.
function makeStream(events: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  async function* gen() {
    for (const e of events) yield e;
  }
  return gen();
}

beforeEach(() => {
  // Fresh store per test — zustand stores are module singletons.
  useChat.setState({ messages: [], isStreaming: false });
  mocks.streamChat.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("useChat.send — regular message flow", () => {
  it("appends user → bot placeholder → metadata → tokens → settled", async () => {
    mocks.streamChat.mockReturnValueOnce(
      makeStream([
        { type: "session", session_id: "sess-1" },
        {
          type: "metadata",
          tier: "exact",
          confidence: 1,
          pairId: 42,
          score: 0,
          lowConfidence: false,
          locale: null,
        },
        { type: "token", content: "hello" },
        { type: "token", content: " world" },
      ]),
    );

    await useChat.getState().send("hi");

    const msgs = useChat.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ kind: "user", text: "hi" });
    expect(msgs[1]).toMatchObject({
      kind: "bot",
      text: "hello world",
      status: "settled",
      noMatch: false,
      meta: { tier: "exact", confidence: 1, pairId: 42, score: 0, lowConfidence: false },
    });
    expect(useChat.getState().isStreaming).toBe(false);
    expect(mocks.streamChat).toHaveBeenCalledWith({ message: "hi" });
  });

  it("trims input before sending; empty input is a no-op", async () => {
    await useChat.getState().send("   ");
    expect(useChat.getState().messages).toEqual([]);
    expect(mocks.streamChat).not.toHaveBeenCalled();

    mocks.streamChat.mockReturnValueOnce(makeStream([{ type: "done" }]));
    await useChat.getState().send("  hi  ");
    expect(mocks.streamChat).toHaveBeenCalledWith({ message: "hi" });
  });
});

describe("useChat.send — teach branch", () => {
  it("appends teach message (no bot placeholder), acks queue id, emits success system msg", async () => {
    mocks.streamChat.mockReturnValueOnce(
      makeStream([
        { type: "session", session_id: "sess-1" },
        { type: "teach_ack", queue_id: 7 },
      ]),
    );

    await useChat.getState().send("/teach hi there");

    const msgs = useChat.getState().messages;
    // teach message + system success — no bot placeholder.
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({
      kind: "teach",
      raw: "/teach hi there",
      acked: { queue_id: 7 },
    });
    expect(msgs[1]).toMatchObject({ kind: "system", variant: "success" });
  });

  it("detects /TEACH case-insensitively (matches server PREFIX_RE)", async () => {
    mocks.streamChat.mockReturnValueOnce(makeStream([{ type: "teach_ack", queue_id: 1 }]));
    await useChat.getState().send("/TEACH hello!");
    const first = useChat.getState().messages[0];
    expect(first?.kind).toBe("teach");
  });
});

describe("useChat.send — no_match branch", () => {
  it("on no_match: sets noMatch=true AND picks a fallback variant from en['noMatch.fallback'] pool", async () => {
    // Server emits no_match as a pure signal — no token events follow.
    // The reducer fills bot.text by random-picking from the dict's
    // noMatch.fallback array. Assert pool MEMBERSHIP (not equality to a
    // specific variant) because the pick is random.
    const enDict = (await import("@/lib/i18n/en")).en;
    mocks.streamChat.mockReturnValueOnce(makeStream([{ type: "no_match" }]));

    await useChat.getState().send("asdfqwer1234");

    const bot = useChat.getState().messages.find((m) => m.kind === "bot");
    if (bot?.kind !== "bot") throw new Error("expected bot message");
    expect(bot.noMatch).toBe(true);
    expect(bot.status).toBe("settled");
    expect(bot.meta).toBeNull();
    // Default primaryLocale is 'en' (preferences store default).
    expect(enDict["noMatch.fallback"]).toContain(bot.text);
  });
});

describe("useChat.send — finally-settle (no structured done event)", () => {
  it("settles bot to 'settled' when the for-await loop exits naturally without `{type:'done'}`", async () => {
    // Mirrors the real wire: the server's lib/sse.ts only writes the
    // literal `[DONE]` terminator, parseSseStream returns silently on it,
    // and the for-await loop sees nothing more. Pre-fix this kept the
    // bot at status='streaming' indefinitely — vote buttons + metadata
    // badge (gated on settled) never appeared.
    mocks.streamChat.mockReturnValueOnce(
      makeStream([
        {
          type: "metadata",
          tier: "exact",
          confidence: 1,
          pairId: 1,
          score: 0,
          lowConfidence: false,
          locale: null,
        },
        { type: "token", content: "hi" },
      ]),
    );

    await useChat.getState().send("hello");

    const bot = useChat.getState().messages.find((m) => m.kind === "bot");
    expect(bot).toMatchObject({ status: "settled", text: "hi" });
  });
});

describe("useChat.send — error handling", () => {
  it("on stream `error` event: marks bot status=error, appends error system msg", async () => {
    mocks.streamChat.mockReturnValueOnce(
      makeStream([
        {
          type: "metadata",
          tier: "exact",
          confidence: 1,
          pairId: 1,
          score: 0,
          lowConfidence: false,
          locale: null,
        },
        { type: "error", message: "internal error" },
      ]),
    );

    await useChat.getState().send("hi");

    const msgs = useChat.getState().messages;
    const bot = msgs.find((m) => m.kind === "bot");
    const sys = msgs.find((m) => m.kind === "system");
    expect(bot).toMatchObject({ status: "error" });
    expect(sys).toMatchObject({ variant: "error", text: "internal error" });
    expect(useChat.getState().isStreaming).toBe(false);
  });

  it("on thrown error from streamChat (network drop): finishes bot as error, clears isStreaming", async () => {
    mocks.streamChat.mockImplementationOnce(async function* (): AsyncGenerator<ChatStreamEvent> {
      yield {
        type: "metadata",
        tier: "fts",
        confidence: 0.5,
        pairId: 2,
        score: 0,
        lowConfidence: false,
        locale: null,
      };
      throw new Error("connection reset");
    });

    await useChat.getState().send("hi");

    const bot = useChat.getState().messages.find((m) => m.kind === "bot");
    expect(bot).toMatchObject({ status: "error" });
    expect(useChat.getState().isStreaming).toBe(false);
  });
});

describe("useChat.send — concurrency guard", () => {
  it("a second send while streaming is dropped (no new messages, streamChat not re-invoked)", async () => {
    // First call: a stream we manually advance, so the store is mid-flight
    // when we issue the second send.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.streamChat.mockImplementationOnce(async function* (): AsyncGenerator<ChatStreamEvent> {
      yield {
        type: "metadata",
        tier: "exact",
        confidence: 1,
        pairId: 1,
        score: 0,
        lowConfidence: false,
        locale: null,
      };
      await gate;
    });

    const first = useChat.getState().send("first");

    // Wait a tick for isStreaming to flip to true.
    await Promise.resolve();
    expect(useChat.getState().isStreaming).toBe(true);

    // Second send: should bail at the isStreaming guard.
    await useChat.getState().send("second");
    expect(mocks.streamChat).toHaveBeenCalledTimes(1);

    // Now let the first finish; assert no "second" user message ever appeared.
    release();
    await first;
    const userTexts = useChat
      .getState()
      .messages.filter((m) => m.kind === "user")
      .map((m) => (m as { text: string }).text);
    expect(userTexts).toEqual(["first"]);
  });
});

describe("useChat.setVote — optimistic + revert", () => {
  it("setVote(id, 1) flips bot.vote; setVote(id, 0) reverts", async () => {
    mocks.streamChat.mockReturnValueOnce(
      makeStream([
        {
          type: "metadata",
          tier: "exact",
          confidence: 1,
          pairId: 99,
          score: 0,
          lowConfidence: false,
          locale: null,
        },
        { type: "token", content: "hi" },
      ]),
    );
    await useChat.getState().send("hello");
    const bot = useChat.getState().messages.find((m) => m.kind === "bot");
    if (!bot || bot.kind !== "bot") throw new Error("no bot message");

    useChat.getState().setVote(bot.id, 1);
    expect(useChat.getState().messages.find((m) => m.id === bot.id)).toMatchObject({ vote: 1 });

    useChat.getState().setVote(bot.id, 0);
    expect(useChat.getState().messages.find((m) => m.id === bot.id)).toMatchObject({ vote: 0 });
  });
});
