import { beforeEach, describe, expect, it, vi } from "vitest";

describe("inflight registry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the same controller for the same threadId", async () => {
    const { getOrCreateAbort } = await import("@/lib/inflight");
    const a = getOrCreateAbort("t1");
    const b = getOrCreateAbort("t1");
    expect(a).toBe(b);
  });

  it("mints a fresh controller after clearAbort", async () => {
    const { getOrCreateAbort, clearAbort } = await import("@/lib/inflight");
    const a = getOrCreateAbort("t1");
    clearAbort("t1");
    const b = getOrCreateAbort("t1");
    expect(a).not.toBe(b);
  });

  it("abortAllInflight aborts every registered controller and clears the map", async () => {
    const { getOrCreateAbort, abortAllInflight } = await import("@/lib/inflight");
    const a = getOrCreateAbort("t1");
    const b = getOrCreateAbort("t2");
    abortAllInflight();
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(true);
    const a2 = getOrCreateAbort("t1");
    expect(a2).not.toBe(a);
  });
});
