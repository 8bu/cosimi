import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ui store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("defaults sidebar closed", async () => {
    const { useUiStore } = await import("@/store/ui");
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });

  it("setSidebarOpen(true) opens the sidebar", async () => {
    const { useUiStore } = await import("@/store/ui");
    useUiStore.getState().setSidebarOpen(true);
    expect(useUiStore.getState().isSidebarOpen).toBe(true);
  });

  it("toggleSidebar flips the flag", async () => {
    const { useUiStore } = await import("@/store/ui");
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });
});
