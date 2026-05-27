import { beforeEach, describe, expect, it, vi } from "vitest";

function sseBody(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i >= frames.length) return c.close();
      c.enqueue(enc.encode(frames[i]!));
      i += 1;
    },
  });
}

function mockResponse(opts: {
  ok: boolean;
  status?: number;
  statusText?: string;
  sessionHeader?: string | null;
  body?: ReadableStream<Uint8Array> | null;
}): Response {
  const headers = new Headers();
  if (opts.sessionHeader) headers.set("X-Session-Id", opts.sessionHeader);
  return new Response(opts.body ?? null, {
    status: opts.status ?? (opts.ok ? 200 : 500),
    statusText: opts.statusText ?? "OK",
    headers,
  });
}

describe("streamChatPortf", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("adopts X-Session-Id from response into sessions store on first call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          ok: true,
          sessionHeader: "srv-abc",
          body: sseBody(['data: {"type":"done"}\n\n', "data: [DONE]\n\n"]),
        }),
      ),
    );
    const { streamChatPortf } = await import("@/lib/streamChat");
    const { useSessionsStore } = await import("@/store/sessions");
    const ac = new AbortController();
    const events: unknown[] = [];
    for await (const ev of streamChatPortf("t1", "hello", ac.signal)) {
      events.push(ev);
    }
    expect(useSessionsStore.getState().get("t1")).toBe("srv-abc");
  });

  it("sends cached X-Session-Id on subsequent calls", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, sessionHeader: "srv-x", body: sseBody(["data: [DONE]\n\n"]) }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    const { streamChatPortf } = await import("@/lib/streamChat");
    const { useSessionsStore } = await import("@/store/sessions");
    useSessionsStore.getState().set("t2", "cached-srv-id");
    const ac = new AbortController();
    for await (const _ of streamChatPortf("t2", "hi", ac.signal)) {
      void _;
    }
    const calledHeaders = (fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(calledHeaders["X-Session-Id"]).toBe("cached-srv-id");
  });

  it("throws on non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 503, statusText: "Bad" })),
    );
    const { streamChatPortf } = await import("@/lib/streamChat");
    const ac = new AbortController();
    await expect(async () => {
      for await (const _ of streamChatPortf("t3", "hi", ac.signal)) {
        void _;
      }
    }).rejects.toThrow(/503/);
  });
});
