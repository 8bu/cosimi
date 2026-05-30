import { describe, expect, it } from "vitest";
import { parseSseStream } from "@/lib/sse-parser";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) return controller.close();
      controller.enqueue(enc.encode(chunks[i]!));
      i += 1;
    },
  });
}

describe("parseSseStream", () => {
  it("yields parsed events and returns on [DONE]", async () => {
    const body = streamOf([
      'data: {"type":"token","content":"hi"}\n\n',
      'data: {"type":"done"}\n\n',
      "data: [DONE]\n\n",
    ]);
    const out: unknown[] = [];
    for await (const ev of parseSseStream(body)) out.push(ev);
    expect(out).toEqual([{ type: "token", content: "hi" }, { type: "done" }]);
  });

  it("handles frame split across chunks", async () => {
    const body = streamOf(['data: {"type":"toke', 'n","content":"x"}\n', "\ndata: [DONE]\n\n"]);
    const out: unknown[] = [];
    for await (const ev of parseSseStream(body)) out.push(ev);
    expect(out).toEqual([{ type: "token", content: "x" }]);
  });

  it("drops malformed JSON without poisoning the stream", async () => {
    const body = streamOf([
      "data: not-json\n\n",
      'data: {"type":"token","content":"ok"}\n\ndata: [DONE]\n\n',
    ]);
    const out: unknown[] = [];
    for await (const ev of parseSseStream(body)) out.push(ev);
    expect(out).toEqual([{ type: "token", content: "ok" }]);
  });
});
