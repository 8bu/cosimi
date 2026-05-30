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

describe("threads store v2 - Phase E expansion", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("create(id) is idempotent when id is already present", async () => {
    const { useThreadsStore } = await import("@/store/threads");
    const id = useThreadsStore.getState().create();
    const sizeBefore = useThreadsStore.getState().threads.length;
    const returned = useThreadsStore.getState().create(id);
    expect(returned).toBe(id);
    expect(useThreadsStore.getState().threads.length).toBe(sizeBefore);
  });

  it("create(id) inserts a new entry when id is not present", async () => {
    const { useThreadsStore } = await import("@/store/threads");
    const ret = useThreadsStore.getState().create("fixed-id-1");
    expect(ret).toBe("fixed-id-1");
    expect(useThreadsStore.getState().threads[0]?.id).toBe("fixed-id-1");
  });

  it("rename updates title in place", async () => {
    const { useThreadsStore } = await import("@/store/threads");
    const id = useThreadsStore.getState().create();
    useThreadsStore.getState().rename(id, "hello world");
    const row = useThreadsStore.getState().threads.find((t) => t.id === id);
    expect(row?.title).toBe("hello world");
  });

  it("touch bumps ts", async () => {
    const { useThreadsStore } = await import("@/store/threads");
    const id = useThreadsStore.getState().create();
    const tsBefore = useThreadsStore.getState().threads.find((t) => t.id === id)!.ts;
    await new Promise((r) => setTimeout(r, 5));
    useThreadsStore.getState().touch(id);
    const tsAfter = useThreadsStore.getState().threads.find((t) => t.id === id)!.ts;
    expect(tsAfter).toBeGreaterThan(tsBefore);
  });

  it("setTitleIfEmpty only writes when title is absent", async () => {
    const { useThreadsStore } = await import("@/store/threads");
    const id = useThreadsStore.getState().create();
    useThreadsStore.getState().setTitleIfEmpty(id, "first");
    expect(useThreadsStore.getState().threads.find((t) => t.id === id)?.title).toBe("first");
    useThreadsStore.getState().setTitleIfEmpty(id, "second");
    expect(useThreadsStore.getState().threads.find((t) => t.id === id)?.title).toBe("first");
  });

  it("remove drops the row from the array", async () => {
    const { useThreadsStore } = await import("@/store/threads");
    const a = useThreadsStore.getState().create();
    const b = useThreadsStore.getState().create();
    useThreadsStore.getState().remove(a);
    const ids = useThreadsStore.getState().threads.map((t) => t.id);
    expect(ids).toEqual([b]);
  });

  it("remove cascades into messages + sessions stores", async () => {
    const { useThreadsStore } = await import("@/store/threads");
    const { useSessionsStore } = await import("@/store/sessions");
    const { useMessagesStore } = await import("@/store/messages");
    const id = useThreadsStore.getState().create();
    useSessionsStore.getState().set(id, "srv-1");
    useMessagesStore.setState({ byThread: { [id]: [] } });
    useThreadsStore.getState().remove(id);
    // Wait for the dynamic import inside remove() to settle. The import()
    // promise resolves after Vite's module-resolution microtasks plus the
    // .then() continuation - a small setTimeout(0) is more reliable than
    // a fixed number of Promise.resolve() ticks.
    await new Promise((r) => setTimeout(r, 0));
    expect(useSessionsStore.getState().get(id)).toBeUndefined();
    expect(useMessagesStore.getState().byThread[id]).toBeUndefined();
  });
});
