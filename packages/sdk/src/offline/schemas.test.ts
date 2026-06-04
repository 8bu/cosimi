import { describe, expect, it } from "vitest";
import { parseGeneration, parseRelations, parseAudit, parseReverse } from "./schemas";

describe("parseGeneration", () => {
  it("parses a valid array", () => {
    expect(parseGeneration('[{"q":"a","b":1,"a":"b"}]')).toEqual([{ q: "a", a: "b" }]);
  });
  it("strips markdown fences before parsing", () => {
    expect(parseGeneration('```json\n[{"q":"x","a":"y"}]\n```')).toEqual([{ q: "x", a: "y" }]);
  });
  it("returns null on malformed JSON", () => {
    expect(parseGeneration("not json")).toBeNull();
  });
  it("returns null when an item lacks q/a", () => {
    expect(parseGeneration('[{"q":"only q"}]')).toBeNull();
  });
  it("returns null on empty array", () => {
    expect(parseGeneration("[]")).toBeNull();
  });
});

describe("parseRelations", () => {
  it("parses valid relations", () => {
    expect(parseRelations('[{"from":0,"to":1,"type":"references"}]')).toEqual([
      { from: 0, to: 1, type: "references" },
    ]);
  });
  it("parses an empty array as []", () => {
    expect(parseRelations("[]")).toEqual([]);
  });
  it("returns null on a bad type", () => {
    expect(parseRelations('[{"from":0,"to":1,"type":"nope"}]')).toBeNull();
  });
});

describe("parseAudit", () => {
  it("parses a pass verdict", () => {
    expect(parseAudit('{"verdict":"pass","reason":"ok","rewritten_answer":null}')).toEqual({
      verdict: "pass",
      reason: "ok",
      rewritten_answer: null,
    });
  });
  it("returns null on bad verdict", () => {
    expect(parseAudit('{"verdict":"maybe","reason":"x","rewritten_answer":null}')).toBeNull();
  });
});

describe("parseReverse", () => {
  it("trims to the question text", () => {
    expect(parseReverse("  How old are you?  ")).toBe("How old are you?");
  });
  it("returns null on empty", () => {
    expect(parseReverse("   ")).toBeNull();
  });
});
