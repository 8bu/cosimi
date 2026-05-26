import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PRESET_ID, PRESETS_VERSION } from "@/config/presets-schema";
import { STORAGE_KEYS } from "@/config/presets-storage";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
afterEach(() => {
  localStorage.clear();
});

function readStoredPresets(): unknown[] {
  const raw = localStorage.getItem(STORAGE_KEYS.presets);
  if (raw === null) return [];
  return (JSON.parse(raw) as { presets: unknown[] }).presets;
}

describe("create()", () => {
  it("returns { ok: true, id } and persists to localStorage", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const r = usePresetsStore.getState().create({ name: "Staging", apiBase: "/api" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(usePresetsStore.getState().presets).toHaveLength(1);
    expect(usePresetsStore.getState().presets[0]!.id).toBe(r.id);
    expect(readStoredPresets()).toHaveLength(1);
  });

  it("rejects duplicate name (case-insensitive)", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    usePresetsStore.getState().create({ name: "Staging", apiBase: "/api" });
    const r = usePresetsStore.getState().create({ name: "STAGING", apiBase: "/api" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.toLowerCase()).toContain("already exists");
  });

  it('rejects the reserved name "Default" (any case)', async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const r = usePresetsStore.getState().create({ name: "default", apiBase: "/api" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.toLowerCase()).toContain("reserved");
  });

  it("rejects empty name", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const r = usePresetsStore.getState().create({ name: "   ", apiBase: "/api" });
    expect(r.ok).toBe(false);
  });

  it("rejects name longer than 40 chars", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const r = usePresetsStore.getState().create({ name: "x".repeat(41), apiBase: "/api" });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed apiBase (new URL throws)", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    // Empirically: 'http://' throws TypeError 'Invalid URL'. Verify
    // first so this test stays honest even if URL parsing relaxes
    // upstream.
    expect(() => new URL("http://", window.location.href)).toThrow();
    const r = usePresetsStore.getState().create({ name: "X", apiBase: "http://" });
    expect(r.ok).toBe(false);
  });

  it("accepts both '/api' relative and absolute origins", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    expect(usePresetsStore.getState().create({ name: "Rel", apiBase: "/api" }).ok).toBe(true);
    expect(
      usePresetsStore.getState().create({ name: "Abs", apiBase: "https://x.test/sub" }).ok,
    ).toBe(true);
  });
});

describe("update()", () => {
  it("modifies fields and bumps updatedAt", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const r = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    if (!r.ok) throw new Error("setup failed");
    const before = usePresetsStore.getState().presets[0]!;
    // Sleep one tick to ensure Date.now() advances even on fast clocks.
    await new Promise((res) => setTimeout(res, 2));
    const u = usePresetsStore.getState().update(r.id, { name: "B", apiBase: "/api/v2" });
    expect(u.ok).toBe(true);
    const after = usePresetsStore.getState().presets[0]!;
    expect(after.name).toBe("B");
    expect(after.apiBase).toBe("/api/v2");
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  });

  it("rejects renaming to another preset's name", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const a = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    const b = usePresetsStore.getState().create({ name: "B", apiBase: "/api" });
    if (!a.ok || !b.ok) throw new Error("setup failed");
    const r = usePresetsStore.getState().update(b.id, { name: "A" });
    expect(r.ok).toBe(false);
  });

  it("allows renaming to the same name (self-id ignored)", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const a = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    if (!a.ok) throw new Error("setup failed");
    const r = usePresetsStore.getState().update(a.id, { name: "A" });
    expect(r.ok).toBe(true);
  });
});

describe("delete()", () => {
  it("removes the entry from store + localStorage", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const a = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    if (!a.ok) throw new Error("setup failed");
    usePresetsStore.getState().delete(a.id);
    expect(usePresetsStore.getState().presets).toHaveLength(0);
    expect(readStoredPresets()).toHaveLength(0);
  });

  it("is a no-op for the synthetic Default id", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const a = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    if (!a.ok) throw new Error("setup failed");
    usePresetsStore.getState().delete(DEFAULT_PRESET_ID);
    expect(usePresetsStore.getState().presets).toHaveLength(1);
  });

  it("is a no-op for an unknown id", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    usePresetsStore.getState().delete("ghost");
    expect(usePresetsStore.getState().presets).toHaveLength(1);
  });

  it("resets activeId to sentinel when deleting the active preset", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const a = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    if (!a.ok) throw new Error("setup failed");
    usePresetsStore.getState().setActive(a.id);
    expect(usePresetsStore.getState().activeId).toBe(a.id);
    usePresetsStore.getState().delete(a.id);
    expect(usePresetsStore.getState().activeId).toBe(DEFAULT_PRESET_ID);
    expect(localStorage.getItem(STORAGE_KEYS.activeId)).toBe(DEFAULT_PRESET_ID);
  });
});

describe("setActive()", () => {
  it("updates activeId and persists", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const a = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    if (!a.ok) throw new Error("setup failed");
    usePresetsStore.getState().setActive(a.id);
    expect(usePresetsStore.getState().activeId).toBe(a.id);
    expect(localStorage.getItem(STORAGE_KEYS.activeId)).toBe(a.id);
  });

  it("is a no-op for an unknown id", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    usePresetsStore.getState().setActive("ghost");
    expect(usePresetsStore.getState().activeId).toBe(DEFAULT_PRESET_ID);
  });

  it("accepts the sentinel", async () => {
    const { usePresetsStore } = await import("@/config/presets-store");
    const a = usePresetsStore.getState().create({ name: "A", apiBase: "/api" });
    if (!a.ok) throw new Error("setup failed");
    usePresetsStore.getState().setActive(a.id);
    usePresetsStore.getState().setActive(DEFAULT_PRESET_ID);
    expect(usePresetsStore.getState().activeId).toBe(DEFAULT_PRESET_ID);
  });
});

describe("selectors", () => {
  it("syntheticDefaultPreset() materializes from env", async () => {
    const { syntheticDefaultPreset } = await import("@/config/presets-store");
    const d = syntheticDefaultPreset();
    expect(d.id).toBe(DEFAULT_PRESET_ID);
    expect(d.name).toBe("Default");
    expect(d.apiBase).toBe("/api");
  });

  it("synthetic Default is NEVER written to storage on init", async () => {
    await import("@/config/presets-store");
    expect(localStorage.getItem(STORAGE_KEYS.presets)).toBeNull();
  });
});

describe("hydration", () => {
  it("rehydrates from localStorage at module load", async () => {
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({
        version: PRESETS_VERSION,
        presets: [{ id: "u1", name: "X", apiBase: "/api", createdAt: 1, updatedAt: 2 }],
      }),
    );
    localStorage.setItem(STORAGE_KEYS.activeId, "u1");
    const { usePresetsStore } = await import("@/config/presets-store");
    expect(usePresetsStore.getState().presets).toHaveLength(1);
    expect(usePresetsStore.getState().activeId).toBe("u1");
  });
});

describe("PRESETS_CHANGED event", () => {
  it("fires after create()", async () => {
    const { usePresetsStore, PRESETS_CHANGED } = await import("@/config/presets-store");
    const listener = vi.fn();
    window.addEventListener(PRESETS_CHANGED, listener);
    usePresetsStore.getState().create({ name: "X", apiBase: "/api" });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(PRESETS_CHANGED, listener);
  });
});
