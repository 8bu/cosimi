import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("threads store", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset module cache so each test gets a fresh store instance rehydrated
    // from the (now-empty) localStorage, preventing cross-test state leakage.
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts with an empty threads array", async () => {
    const { useThreadsStore } = await import("../threads");
    expect(useThreadsStore.getState().threads).toEqual([]);
  });

  it("create() returns an RFC4122 v4 UUID", async () => {
    const { useThreadsStore } = await import("../threads");
    const id = useThreadsStore.getState().create();
    expect(id).toMatch(UUID_V4_RE);
  });

  it("create() prepends a new entry (newest first)", async () => {
    const { useThreadsStore } = await import("../threads");
    const first = useThreadsStore.getState().create();
    // Sleep 1ms to guarantee a distinct ts for stable ordering assertion.
    await new Promise((r) => setTimeout(r, 1));
    const second = useThreadsStore.getState().create();

    const list = useThreadsStore.getState().threads;
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(second);
    expect(list[1]!.id).toBe(first);
    expect(list[0]!.ts).toBeGreaterThanOrEqual(list[1]!.ts);
  });

  it("persists to localStorage under key 'portf.threads'", async () => {
    const { useThreadsStore } = await import("../threads");
    const id = useThreadsStore.getState().create();

    const raw = localStorage.getItem("portf.threads");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.threads).toHaveLength(1);
    expect(parsed.state.threads[0].id).toBe(id);
    expect(typeof parsed.state.threads[0].ts).toBe("number");
  });
});
