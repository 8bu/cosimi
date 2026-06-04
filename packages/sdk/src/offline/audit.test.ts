import { describe, expect, it } from "vitest";
import { auditPair, reverseCheck } from "./audit";
import { createFakeLLM } from "@cosimi/adapter-llm-fake";
import { createScriptedEmbedder } from "../../test/fake-embedder";

describe("auditPair", () => {
  it("returns the pass decision", async () => {
    const llm = createFakeLLM(() =>
      JSON.stringify({ verdict: "pass", reason: "ok", rewritten_answer: null }),
    );
    expect(await auditPair(llm, "ctx", "q", "a")).toEqual({ action: "pass" });
  });

  it("returns a rewrite decision with the corrected answer", async () => {
    const llm = createFakeLLM(() =>
      JSON.stringify({ verdict: "rewrite", reason: "date", rewritten_answer: "1900" }),
    );
    expect(await auditPair(llm, "ctx", "q", "a")).toEqual({ action: "rewrite", response: "1900" });
  });

  it("returns fail", async () => {
    const llm = createFakeLLM(() =>
      JSON.stringify({ verdict: "fail", reason: "ungrounded", rewritten_answer: null }),
    );
    expect(await auditPair(llm, "ctx", "q", "a")).toEqual({ action: "fail" });
  });

  it("treats rewrite with null rewritten_answer as skip", async () => {
    const llm = createFakeLLM(() =>
      JSON.stringify({ verdict: "rewrite", reason: "x", rewritten_answer: null }),
    );
    expect(await auditPair(llm, "ctx", "q", "a")).toEqual({ action: "skip" });
  });

  it("treats malformed output as skip", async () => {
    const llm = createFakeLLM(() => "garbage");
    expect(await auditPair(llm, "ctx", "q", "a")).toEqual({ action: "skip" });
  });
});

describe("reverseCheck", () => {
  it("flags when the regenerated question drifts below threshold", async () => {
    const llm = createFakeLLM(() => "totally different question");
    const embedder = createScriptedEmbedder(new Map([["totally different question", [0, 1]]]), 2);
    const flagged = await reverseCheck(llm, embedder, "answer", [1, 0], 0.75);
    expect(flagged).toBe(true); // cosine([0,1],[1,0]) = 0 < 0.75
  });

  it("does not flag when the regenerated question stays close", async () => {
    const llm = createFakeLLM(() => "same direction question");
    const embedder = createScriptedEmbedder(new Map([["same direction question", [1, 0]]]), 2);
    expect(await reverseCheck(llm, embedder, "answer", [1, 0], 0.75)).toBe(false);
  });

  it("does not flag when reverse output is empty (cannot evaluate)", async () => {
    const llm = createFakeLLM(() => "   ");
    const embedder = createScriptedEmbedder(new Map(), 2);
    expect(await reverseCheck(llm, embedder, "answer", [1, 0], 0.75)).toBe(false);
  });
});
