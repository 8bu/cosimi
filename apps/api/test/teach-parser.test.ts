import { describe, expect, it } from "vitest";

import { parseTeachCommand, looksLikeTeach } from "../src/services/teach-parser";

describe("teach-parser", () => {
  describe("looksLikeTeach", () => {
    it("matches '/teach ' prefix case-insensitively", () => {
      expect(looksLikeTeach("/teach hi")).toBe(true);
      expect(looksLikeTeach("/TEACH hi")).toBe(true);
      expect(looksLikeTeach("/Teach hi")).toBe(true);
    });

    it("matches bare '/teach' (no payload)", () => {
      expect(looksLikeTeach("/teach")).toBe(true);
    });

    it("rejects messages that only mention /teach later", () => {
      expect(looksLikeTeach("please /teach me something")).toBe(false);
      expect(looksLikeTeach(" /teach foo")).toBe(false); // leading space disqualifies
    });

    it("rejects similar prefixes", () => {
      expect(looksLikeTeach("/teachable")).toBe(false);
      expect(looksLikeTeach("/teaches")).toBe(false);
    });
  });

  describe("parseTeachCommand", () => {
    it("parses the implicit (reply-only) form", () => {
      expect(parseTeachCommand("/teach hi there!")).toEqual({
        ok: true,
        input: null,
        reply: "hi there!",
      });
    });

    it("parses the explicit input=>reply form", () => {
      expect(parseTeachCommand('/teach "hello world" => "hi back"')).toEqual({
        ok: true,
        input: "hello world",
        reply: "hi back",
      });
    });

    it("trims surrounding whitespace in explicit form", () => {
      expect(parseTeachCommand('/teach  "  foo  " => "  bar  "')).toEqual({
        ok: true,
        input: "foo",
        reply: "bar",
      });
    });

    it("rejects non-teach messages", () => {
      expect(parseTeachCommand("hello")).toEqual({
        ok: false,
        error: "not a teach command",
      });
    });

    it("rejects empty teach payload", () => {
      expect(parseTeachCommand("/teach")).toEqual({
        ok: false,
        error: "empty teach payload",
      });
      expect(parseTeachCommand("/teach   ")).toEqual({
        ok: false,
        error: "empty teach payload",
      });
    });

    it("treats malformed explicit form as implicit reply (best-effort)", () => {
      // Missing the second quote pair → falls through to implicit.
      // Acceptable degradation: the parser doesn't know if the user meant
      // explicit form badly, or implicit form with stray quotes.
      expect(parseTeachCommand('/teach "foo" => bar')).toEqual({
        ok: true,
        input: null,
        reply: '"foo" => bar',
      });
    });
  });
});
