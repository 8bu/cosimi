import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@simlm/db";

import { app } from "../src/app";
import { consumeChatStream, drain, newSessionId, postJson, resetDb, seedPairs } from "./helpers";

describe("POST /chat", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("streams session → metadata → token… → [DONE] for an exact match", async () => {
    await seedPairs([{ input: "hello", response: "hi there", source: "seed" }]);

    const sessionId = newSessionId();
    const res = await postJson(app, "/chat", { message: "hello", session_id: sessionId });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-session-id")).toBe(sessionId);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);

    const events = await consumeChatStream(res);
    expect(events[0]).toEqual({ type: "session", session_id: sessionId });

    const metadata = events.find((e) => e.type === "metadata");
    expect(metadata).toBeDefined();
    if (metadata?.type !== "metadata") throw new Error("unreachable");
    expect(metadata.tier).toBe("exact");
    expect(metadata.confidence).toBe(1.0);
    expect(metadata.lowConfidence).toBe(false);

    const tokens = events.filter((e) => e.type === "token");
    expect(tokens.length).toBeGreaterThan(0);
    const reconstructed = tokens.map((t) => (t.type === "token" ? t.content : "")).join("");
    expect(reconstructed).toBe("hi there");
  });

  it("substitutes {{ name }} placeholders from app_config into the streamed response", async () => {
    // Migration 009 seeds app_config with name=Bé Sim; the test TRUNCATE list
    // does not include app_config, so the seeded row survives every reset.
    await seedPairs([
      { input: "hello", response: "mình tên {{ name }}, rất vui được gặp bạn", source: "seed" },
    ]);

    const res = await postJson(app, "/chat", { message: "hello" });
    expect(res.status).toBe(200);

    const events = await consumeChatStream(res);
    const reconstructed = events
      .filter((e) => e.type === "token")
      .map((t) => (t.type === "token" ? t.content : ""))
      .join("");
    expect(reconstructed).toBe("mình tên Bé Sim, rất vui được gặp bạn");
  });

  it("mints a session id when none is provided and echoes it in X-Session-Id", async () => {
    await seedPairs([{ input: "hello", response: "hi there", source: "seed" }]);

    const res = await postJson(app, "/chat", { message: "hello" });

    expect(res.status).toBe(200);
    const minted = res.headers.get("x-session-id");
    expect(minted).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const events = await consumeChatStream(res);
    const session = events.find((e) => e.type === "session");
    expect(session).toEqual({ type: "session", session_id: minted });
  });

  it("prefers the body session_id over the X-Session-Id header", async () => {
    const bodyId = newSessionId();
    const headerId = newSessionId();
    const res = await postJson(
      app,
      "/chat",
      { message: "anything", session_id: bodyId },
      { "x-session-id": headerId },
    );
    expect(res.headers.get("x-session-id")).toBe(bodyId);
    // Drain so the handler's sessions upsert finishes before the next
    // test's resetDb() takes an ACCESS EXCLUSIVE lock for TRUNCATE.
    await drain(res);
  });

  it("falls back to the X-Session-Id header when body has no session_id", async () => {
    const headerId = newSessionId();
    const res = await postJson(app, "/chat", { message: "anything" }, { "x-session-id": headerId });
    expect(res.headers.get("x-session-id")).toBe(headerId);
    await drain(res);
  });

  it("mints a fresh UUID when the provided session id is not a valid UUID", async () => {
    const res = await postJson(
      app,
      "/chat",
      { message: "anything" },
      { "x-session-id": "not-a-uuid" },
    );
    const minted = res.headers.get("x-session-id");
    expect(minted).not.toBe("not-a-uuid");
    expect(minted).toMatch(/^[0-9a-f]{8}-/);
    await drain(res);
  });

  it("emits no_match and increments unanswered idempotently on repeated misses", async () => {
    const sessionId = newSessionId();

    const res1 = await postJson(app, "/chat", {
      message: "totally novel question",
      session_id: sessionId,
    });
    const events1 = await consumeChatStream(res1);
    expect(events1.some((e) => e.type === "no_match")).toBe(true);

    const res2 = await postJson(app, "/chat", {
      message: "totally novel question",
      session_id: sessionId,
    });
    const events2 = await consumeChatStream(res2);
    expect(events2.some((e) => e.type === "no_match")).toBe(true);

    const rows = await sql()<{ count: number }[]>`
      SELECT count FROM unanswered WHERE normalized_input = 'totally novel question'
    `;
    expect(rows[0]?.count).toBe(2);
  });

  it("upserts sessions.last_input even on a miss so a follow-up /teach works", async () => {
    const sessionId = newSessionId();
    // Drain so the sessions upsert is committed before we read it back.
    await drain(
      await postJson(app, "/chat", { message: "what's the weather like?", session_id: sessionId }),
    );
    const rows = await sql()<{ last_input: string | null }[]>`
      SELECT last_input FROM sessions WHERE session_id = ${sessionId}::uuid
    `;
    expect(rows[0]?.last_input).toBe("what's the weather like?");
  });

  it("rejects an empty message with 400", async () => {
    const res = await postJson(app, "/chat", { message: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a message > 2000 chars with 400", async () => {
    const res = await postJson(app, "/chat", { message: "x".repeat(2001) });
    expect(res.status).toBe(400);
  });

  describe("locale-aware no_match + metadata.locale (Phase 11.1)", () => {
    it("emits no_match as a pure signal — no fallback tokens (FE owns the wording)", async () => {
      // The fallback message is FE chrome (i18n); the server keeps out of
      // it so a client-side locale switch doesn't have to round-trip.
      // Tokens MUST be absent on the no_match path — if a future change
      // re-introduces them, this test guards against the regression.
      const res = await postJson(app, "/chat", { message: "novel input vi", locales: ["vi"] });
      const events = await consumeChatStream(res);
      expect(events.some((e) => e.type === "no_match")).toBe(true);
      const tokens = events.filter((e) => e.type === "token");
      expect(tokens).toEqual([]);
    });

    it("locales=['en'] also yields a token-free no_match (server text-agnostic on the miss path)", async () => {
      const res = await postJson(app, "/chat", { message: "novel input en", locales: ["en"] });
      const events = await consumeChatStream(res);
      expect(events.some((e) => e.type === "no_match")).toBe(true);
      expect(events.filter((e) => e.type === "token")).toEqual([]);
    });

    it("carries metadata.locale when EXPOSE_MATCH_INSIGHTS=true (default in tests)", async () => {
      await seedPairs([
        { input: "meo meo", response: "bé mèo đáng iu", source: "seed", locale: "vi" },
      ]);
      const res = await postJson(app, "/chat", { message: "meo meo", locales: ["vi", "und"] });
      const events = await consumeChatStream(res);
      const meta = events.find((e) => e.type === "metadata");
      if (meta?.type !== "metadata") throw new Error("expected metadata event");
      expect(meta.locale).toBe("vi");
      expect(meta.tier).toBe("exact");
    });

    it("returns the matched-row locale, not the requested locale, when a 'und' row catches the request", async () => {
      await seedPairs([
        { input: "universal", response: "hello, friend", source: "seed", locale: "und" },
      ]);
      const res = await postJson(app, "/chat", { message: "universal", locales: ["vi", "und"] });
      const events = await consumeChatStream(res);
      const meta = events.find((e) => e.type === "metadata");
      if (meta?.type !== "metadata") throw new Error("expected metadata event");
      expect(meta.locale).toBe("und");
    });

    it("falls through across locale list — picks en when vi has no hit", async () => {
      await seedPairs([
        { input: "novel cat phrase", response: "meow!", source: "seed", locale: "en" },
      ]);
      const res = await postJson(app, "/chat", {
        message: "novel cat phrase",
        locales: ["vi", "en"],
      });
      const events = await consumeChatStream(res);
      const meta = events.find((e) => e.type === "metadata");
      if (meta?.type !== "metadata") throw new Error("expected metadata event");
      expect(meta.locale).toBe("en");
    });
  });
});
