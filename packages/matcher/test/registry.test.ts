import { describe, expect, it } from "vitest";
import type { MatchResult } from "@cosimi/core";

import { runCascade } from "../src/registry";
import type { TierContext, TierHandler } from "../src/types";

// runCascade is pure orchestration — no DB needed. The sql accessor is never
// called because the fake handlers don't touch it.
const ctx: TierContext = {
  sql: (() => {
    throw new Error("sql should not be called by these handlers");
  }) as unknown as TierContext["sql"],
  normalizedInput: "x",
  locale: "und",
  sessionId: null,
  topK: 5,
  ftsMin: 0.01,
  trgmMin: 0.3,
};

function hit(name: string): MatchResult {
  return {
    response: name,
    tier: "exact",
    confidence: 1,
    pairId: null,
    score: null,
    lowConfidence: false,
    locale: "und",
    topic: null,
  };
}

describe("runCascade", () => {
  it("short-circuits on the first non-null handler", async () => {
    const calls: string[] = [];
    const handlers: TierHandler[] = [
      {
        name: "a",
        run: async () => {
          calls.push("a");
          return null;
        },
      },
      {
        name: "b",
        run: async () => {
          calls.push("b");
          return hit("b");
        },
      },
      {
        name: "c",
        run: async () => {
          calls.push("c");
          return hit("c");
        },
      },
    ];
    const result = await runCascade(handlers, ctx);
    expect(result?.response).toBe("b");
    expect(calls).toEqual(["a", "b"]);
  });

  it("returns null when all handlers miss", async () => {
    const handlers: TierHandler[] = [
      { name: "a", run: async () => null },
      { name: "b", run: async () => null },
    ];
    expect(await runCascade(handlers, ctx)).toBeNull();
  });

  it("runs handlers in registration order", async () => {
    const order: string[] = [];
    const handlers: TierHandler[] = ["one", "two", "three"].map((n) => ({
      name: n,
      run: async () => {
        order.push(n);
        return null;
      },
    }));
    await runCascade(handlers, ctx);
    expect(order).toEqual(["one", "two", "three"]);
  });
});
