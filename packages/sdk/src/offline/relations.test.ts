import { describe, expect, it } from "vitest";
import { extractRelations } from "./relations";
import { createFakeLLM } from "@cosimi/adapter-llm-fake";

const RT = {
  references: "REFERENCES",
  elaborates: "ELABORATES",
  contradicts: "CONTRADICTS",
} as const;

describe("extractRelations", () => {
  it("returns [] when fewer than 3 chunks (LLM not called)", async () => {
    let called = false;
    const llm = createFakeLLM(() => {
      called = true;
      return "[]";
    });
    expect(await extractRelations(llm, ["a", "b"])).toEqual([]);
    expect(called).toBe(false);
  });

  it("maps lowercase types to RelationType and drops out-of-range indices", async () => {
    const llm = createFakeLLM(() =>
      JSON.stringify([
        { from: 0, to: 2, type: "references" },
        { from: 0, to: 9, type: "elaborates" },
        { from: 1, to: 1, type: "contradicts" },
      ]),
    );
    const edges = await extractRelations(llm, ["a", "b", "c"]);
    expect(edges).toEqual([{ from: 0, to: 2, type: RT.references }]);
  });

  it("returns [] on malformed output", async () => {
    const llm = createFakeLLM(() => "nope");
    expect(await extractRelations(llm, ["a", "b", "c"])).toEqual([]);
  });
});
