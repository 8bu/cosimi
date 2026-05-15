import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@simlm/db";

import { app } from "../src/app";
import { consumeChatStream, drain, newSessionId, postJson, resetDb } from "./helpers";

describe("POST /chat — /teach branch", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("inserts into teach_queue + session_teaches after a prior chat turn", async () => {
    const sessionId = newSessionId();
    // Prior turn (miss is fine — we just need sessions.last_input set).
    // Drain so the sessions upsert commits before we /teach.
    await drain(await postJson(app, "/chat", { message: "what's up", session_id: sessionId }));

    const res = await postJson(app, "/chat", {
      message: "/teach not much, you?",
      session_id: sessionId,
    });
    const events = await consumeChatStream(res);

    const ack = events.find((e) => e.type === "teach_ack");
    expect(ack).toBeDefined();
    if (ack?.type !== "teach_ack") throw new Error("unreachable");
    expect(ack.queue_id).toBeGreaterThan(0);

    const queue = await sql()<{ input: string; response: string; status: string }[]>`
      SELECT input, response, status FROM teach_queue WHERE id = ${ack.queue_id}
    `;
    expect(queue[0]).toEqual({
      input: "what's up",
      response: "not much, you?",
      status: "pending",
    });

    const cache = await sql()<{ response: string }[]>`
      SELECT response FROM session_teaches
       WHERE session_id = ${sessionId}::uuid AND teach_queue_id = ${ack.queue_id}
    `;
    expect(cache[0]?.response).toBe("not much, you?");
  });

  it('supports the explicit /teach "input" => "reply" form without prior turn', async () => {
    const sessionId = newSessionId();
    const res = await postJson(app, "/chat", {
      message: '/teach "hi" => "hello"',
      session_id: sessionId,
    });
    const events = await consumeChatStream(res);
    const ack = events.find((e) => e.type === "teach_ack");
    expect(ack).toBeDefined();

    const queue = await sql()<{ input: string; response: string }[]>`
      SELECT input, response FROM teach_queue WHERE submitted_by_session = ${sessionId}::uuid
    `;
    expect(queue[0]).toEqual({ input: "hi", response: "hello" });
  });

  it("emits the helpful 'I don't know what to teach about' error when no prior input", async () => {
    const sessionId = newSessionId();
    const res = await postJson(app, "/chat", {
      message: "/teach a reply with no context",
      session_id: sessionId,
    });
    const events = await consumeChatStream(res);
    const err = events.find((e) => e.type === "error");
    expect(err).toBeDefined();
    if (err?.type !== "error") throw new Error("unreachable");
    expect(err.message).toMatch(/don't know what to teach about/i);
  });

  it("makes the freshly-taught reply matchable to the same session immediately", async () => {
    const sessionId = newSessionId();
    await drain(
      await postJson(app, "/chat", {
        message: '/teach "secret handshake" => "thumbs up"',
        session_id: sessionId,
      }),
    );

    const res = await postJson(app, "/chat", {
      message: "secret handshake",
      session_id: sessionId,
    });
    const events = await consumeChatStream(res);

    const metadata = events.find((e) => e.type === "metadata");
    if (metadata?.type !== "metadata") throw new Error("expected metadata");
    expect(metadata.tier).toBe("session_teach");

    const tokens = events.filter((e) => e.type === "token");
    const reply = tokens.map((t) => (t.type === "token" ? t.content : "")).join("");
    expect(reply).toBe("thumbs up");
  });

  it("does not leak the teach to other sessions (session-scoped cache)", async () => {
    const sessionA = newSessionId();
    const sessionB = newSessionId();
    await drain(
      await postJson(app, "/chat", {
        message: '/teach "blurple" => "is a real word"',
        session_id: sessionA,
      }),
    );

    const res = await postJson(app, "/chat", {
      message: "blurple",
      session_id: sessionB,
    });
    const events = await consumeChatStream(res);
    expect(events.some((e) => e.type === "no_match")).toBe(true);
  });

  it("rejects an over-length reply with a TeachError-shaped SSE error event", async () => {
    const sessionId = newSessionId();
    const huge = "x".repeat(600); // default TEACH_MAX_LENGTH is 500
    const res = await postJson(app, "/chat", {
      message: `/teach "trigger" => "${huge}"`,
      session_id: sessionId,
    });
    const events = await consumeChatStream(res);
    const err = events.find((e) => e.type === "error");
    if (err?.type !== "error") throw new Error("expected error event");
    expect(err.message).toMatch(/reply too long/i);
  });
});
