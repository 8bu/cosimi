import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SUGGESTION_CHIPS } from "../data";
import { useSampledChips } from "../use-sampled-chips";

afterEach(() => cleanup());

describe("useSampledChips", () => {
  it("settles on 5 chips, all from the pool", async () => {
    const { result } = renderHook(() => useSampledChips(5));
    await waitFor(() => expect(result.current).toHaveLength(5));
    const labels = new Set(result.current.map((c) => c.label));
    expect(labels.size).toBe(5);
    for (const c of result.current) expect(SUGGESTION_CHIPS).toContainEqual(c);
  });
});
