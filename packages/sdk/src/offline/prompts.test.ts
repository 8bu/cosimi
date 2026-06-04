import { describe, expect, it } from "vitest";
import {
  GENERATION_SYSTEM,
  RELATION_SYSTEM,
  AUDIT_SYSTEM,
  REVERSE_SYSTEM,
  generationUser,
  relationUser,
  auditUser,
  reverseUser,
} from "./prompts";

describe("system prompts", () => {
  it("generation prompt demands a JSON array and allows zero pairs for fact-poor chunks", () => {
    expect(GENERATION_SYSTEM).toContain("Q&A pair generator");
    expect(GENERATION_SYSTEM).toContain("up to 5 pairs");
    expect(GENERATION_SYSTEM).toContain("output an empty array");
  });
  it("audit prompt demands a strict verdict object", () => {
    expect(AUDIT_SYSTEM).toContain('"verdict"');
  });
  it("relation + reverse systems exist", () => {
    expect(RELATION_SYSTEM).toContain("cross-references");
    expect(REVERSE_SYSTEM).toContain("most natural question");
  });
});

describe("user templates", () => {
  it("generationUser wraps the chunk", () => {
    expect(generationUser("hello")).toBe("<chunk>hello</chunk>");
  });
  it("relationUser numbers chunks from 0", () => {
    expect(relationUser(["a", "b"])).toContain("[0] a");
    expect(relationUser(["a", "b"])).toContain("[1] b");
  });
  it("auditUser embeds chunk + Q + A", () => {
    const u = auditUser("ctx", "why?", "because");
    expect(u).toContain("<chunk>ctx</chunk>");
    expect(u).toContain("Q: why?");
    expect(u).toContain("A: because");
  });
  it("reverseUser embeds the answer", () => {
    expect(reverseUser("the answer")).toContain("Answer: the answer");
  });
});
