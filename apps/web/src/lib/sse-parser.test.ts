import { describe, expect, it } from "vitest";

import type { ChatStreamEvent } from "@simlm/types";

import { parseSseStream } from "./sse-parser";

/** Build a ReadableStream<Uint8Array> from an iterable of byte chunks. */
function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === "string" ? enc.encode(c) : c);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const e of parseSseStream(stream)) out.push(e);
  return out;
}

describe("parseSseStream", () => {
  it("parses a full session→metadata→token×N→done→[DONE] stream", async () => {
    const frames = [
      `data: ${JSON.stringify({ type: "session", session_id: "abc" })}\n\n`,
      `data: ${JSON.stringify({
        type: "metadata",
        tier: "exact",
        confidence: 1,
        pairId: 42,
        score: 0,
        lowConfidence: false,
      })}\n\n`,
      `data: ${JSON.stringify({ type: "token", content: "hello " })}\n\n`,
      `data: ${JSON.stringify({ type: "token", content: "world" })}\n\n`,
      `data: ${JSON.stringify({ type: "done" })}\n\n`,
      `data: [DONE]\n\n`,
    ].join("");
    const events = await collect(streamOf([frames]));
    expect(events).toEqual([
      { type: "session", session_id: "abc" },
      {
        type: "metadata",
        tier: "exact",
        confidence: 1,
        pairId: 42,
        score: 0,
        lowConfidence: false,
      },
      { type: "token", content: "hello " },
      { type: "token", content: "world" },
      { type: "done" },
    ]);
  });

  it("handles chunk split mid-frame (bytes arrive in arbitrary boundaries)", async () => {
    const full = `data: ${JSON.stringify({ type: "token", content: "hi" })}\n\ndata: [DONE]\n\n`;
    // Slice every 3 chars to force frames to span chunks.
    const chunks: string[] = [];
    for (let i = 0; i < full.length; i += 3) chunks.push(full.slice(i, i + 3));
    const events = await collect(streamOf(chunks));
    expect(events).toEqual([{ type: "token", content: "hi" }]);
  });

  it("terminates on [DONE] and ignores any frames after it", async () => {
    const frames = [
      `data: ${JSON.stringify({ type: "token", content: "a" })}\n\n`,
      `data: [DONE]\n\n`,
      // Should NEVER be yielded — we returned out of the generator.
      `data: ${JSON.stringify({ type: "token", content: "b" })}\n\n`,
    ].join("");
    const events = await collect(streamOf([frames]));
    expect(events).toEqual([{ type: "token", content: "a" }]);
  });

  it("flushes a trailing frame missing its \\n\\n terminator (connection dropped mid-stream)", async () => {
    const frames = [
      `data: ${JSON.stringify({ type: "token", content: "x" })}\n\n`,
      // Note: no trailing \n\n — simulates a server crash mid-flight.
      `data: ${JSON.stringify({ type: "token", content: "y" })}`,
    ].join("");
    const events = await collect(streamOf([frames]));
    expect(events).toEqual([
      { type: "token", content: "x" },
      { type: "token", content: "y" },
    ]);
  });

  it("ignores malformed JSON frames rather than throwing", async () => {
    const frames = [
      `data: ${JSON.stringify({ type: "token", content: "ok" })}\n\n`,
      `data: {not valid json\n\n`,
      `data: [DONE]\n\n`,
    ].join("");
    const events = await collect(streamOf([frames]));
    expect(events).toEqual([{ type: "token", content: "ok" }]);
  });

  it("ignores comment and event: lines (server uses pure-data framing, but be tolerant)", async () => {
    const frames = [
      `: keepalive\n\n`,
      `event: ignored\ndata: ${JSON.stringify({ type: "token", content: "k" })}\n\n`,
      `data: [DONE]\n\n`,
    ].join("");
    const events = await collect(streamOf([frames]));
    expect(events).toEqual([{ type: "token", content: "k" }]);
  });

  it("handles a [DONE]-only stream (empty turn)", async () => {
    const events = await collect(streamOf([`data: [DONE]\n\n`]));
    expect(events).toEqual([]);
  });

  it("releases the reader lock when the consumer aborts mid-stream", async () => {
    // Hand-built ReadableStream that we never close — we'll cancel it
    // from the outside to simulate AbortSignal-triggered cleanup.
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
        const enc = new TextEncoder();
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({ type: "token", content: "a" })}\n\n`),
        );
      },
    });

    const gen = parseSseStream(stream);
    const first = await gen.next();
    expect(first.value).toEqual({ type: "token", content: "a" });

    // Caller aborts: closing the generator runs the parser's finally block,
    // which releases the reader lock. If it didn't, the next getReader()
    // call below would throw "ReadableStream is locked."
    await gen.return(undefined);

    // Push one more event so there's something to read with a fresh reader.
    const enc = new TextEncoder();
    controllerRef!.enqueue(enc.encode(`data: [DONE]\n\n`));
    controllerRef!.close();

    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toBe(`data: [DONE]\n\n`);
    reader.releaseLock();
  });
});
