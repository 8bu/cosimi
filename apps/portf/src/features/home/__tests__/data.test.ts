import { describe, expect, it } from "vitest";
import { SUGGESTION_CHIPS, sampleChips } from "../data";

describe("sampleChips", () => {
  it("returns n distinct chips, all from the pool", () => {
    const picked = sampleChips(SUGGESTION_CHIPS, 5);
    expect(picked).toHaveLength(5);
    const labels = new Set(picked.map((c) => c.label));
    expect(labels.size).toBe(5);
    for (const c of picked) expect(SUGGESTION_CHIPS).toContainEqual(c);
  });

  it("never returns more than the pool size", () => {
    const picked = sampleChips(SUGGESTION_CHIPS.slice(0, 3), 5);
    expect(picked.length).toBe(3);
  });

  it("pool is large enough to sample 5 and has unique labels + marks", () => {
    expect(SUGGESTION_CHIPS.length).toBeGreaterThanOrEqual(5);
    const labels = new Set(SUGGESTION_CHIPS.map((c) => c.label));
    const marks = new Set(SUGGESTION_CHIPS.map((c) => c.mark));
    expect(labels.size).toBe(SUGGESTION_CHIPS.length);
    expect(marks.size).toBe(SUGGESTION_CHIPS.length);
  });
});
