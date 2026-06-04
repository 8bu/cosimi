import { describe, expect, it } from "vitest";
import { generatePairs } from "./generate";
import { createFakeLLM } from "@cosimi/adapter-llm-fake";

describe("generatePairs", () => {
  it("returns validated pairs, sliced to pairsPerChunk", async () => {
    const llm = createFakeLLM(() =>
      JSON.stringify([
        { q: "q1", a: "a1" },
        { q: "q2", a: "a2" },
        { q: "q3", a: "a3" },
      ]),
    );
    const pairs = await generatePairs(llm, "chunk text", 2);
    expect(pairs).toEqual([
      { q: "q1", a: "a1" },
      { q: "q2", a: "a2" },
    ]);
  });

  it("returns [] on malformed LLM output", async () => {
    const llm = createFakeLLM(() => "garbage");
    expect(await generatePairs(llm, "chunk", 5)).toEqual([]);
  });
});
