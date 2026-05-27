import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sessions store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("set + get round-trips", async () => {
    const { useSessionsStore } = await import("@/store/sessions");
    useSessionsStore.getState().set("t1", "srv-1");
    expect(useSessionsStore.getState().get("t1")).toBe("srv-1");
  });

  it("get returns undefined for unknown threadId", async () => {
    const { useSessionsStore } = await import("@/store/sessions");
    expect(useSessionsStore.getState().get("nope")).toBeUndefined();
  });

  it("clear removes the key", async () => {
    const { useSessionsStore } = await import("@/store/sessions");
    useSessionsStore.getState().set("t1", "srv-1");
    useSessionsStore.getState().clear("t1");
    expect(useSessionsStore.getState().get("t1")).toBeUndefined();
  });

  it("persists under portf.sessions", async () => {
    const { useSessionsStore } = await import("@/store/sessions");
    useSessionsStore.getState().set("t1", "srv-1");
    const raw = localStorage.getItem("portf.sessions");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).state.byThread).toEqual({ t1: "srv-1" });
  });
});
