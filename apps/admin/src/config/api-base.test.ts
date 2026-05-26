import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PRESET_ID, PRESETS_VERSION } from "@/config/presets-schema";
import { STORAGE_KEYS } from "@/config/presets-storage";

// import.meta.env is rolled into the test build by Vite — VITE_API_BASE
// is undefined in the test env, so DEFAULT_API_BASE inside the module
// resolves to "/api" via the `?? "/api"` fallback.
const DEFAULT_API_BASE = "/api";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  // Reset module cache so the `attached` flag in bootstrapApiBase
  // doesn't leak between tests.
  vi.resetModules();
});
afterEach(() => {
  localStorage.clear();
});

describe("getApiBase()", () => {
  it("returns DEFAULT when localStorage is empty", async () => {
    const { getApiBase } = await import("@/config/api-base");
    expect(getApiBase()).toBe(DEFAULT_API_BASE);
  });

  it("returns DEFAULT when activeId is the sentinel", async () => {
    localStorage.setItem(STORAGE_KEYS.activeId, DEFAULT_PRESET_ID);
    const { getApiBase } = await import("@/config/api-base");
    expect(getApiBase()).toBe(DEFAULT_API_BASE);
  });

  it("returns the matching preset's apiBase when activeId is a stored id", async () => {
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({
        version: PRESETS_VERSION,
        presets: [
          {
            id: "u1",
            name: "Staging",
            apiBase: "https://staging.test/",
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      }),
    );
    localStorage.setItem(STORAGE_KEYS.activeId, "u1");
    const { getApiBase } = await import("@/config/api-base");
    expect(getApiBase()).toBe("https://staging.test/");
  });

  it("returns DEFAULT when activeId is stale (no longer in the list)", async () => {
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({ version: PRESETS_VERSION, presets: [] }),
    );
    localStorage.setItem(STORAGE_KEYS.activeId, "ghost-id");
    const { getApiBase } = await import("@/config/api-base");
    expect(getApiBase()).toBe(DEFAULT_API_BASE);
  });

  it("returns DEFAULT when presets JSON is malformed", async () => {
    localStorage.setItem(STORAGE_KEYS.presets, "not json{");
    localStorage.setItem(STORAGE_KEYS.activeId, "u1");
    const { getApiBase } = await import("@/config/api-base");
    expect(getApiBase()).toBe(DEFAULT_API_BASE);
  });

  it("returns DEFAULT on future-incompatible version", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({ version: 99, presets: [{ id: "u1", apiBase: "x" }] }),
    );
    localStorage.setItem(STORAGE_KEYS.activeId, "u1");
    const { getApiBase } = await import("@/config/api-base");
    expect(getApiBase()).toBe(DEFAULT_API_BASE);
  });

  it("reads fresh on every call (no module-level snapshot)", async () => {
    const { getApiBase } = await import("@/config/api-base");
    expect(getApiBase()).toBe(DEFAULT_API_BASE);
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({
        version: PRESETS_VERSION,
        presets: [
          {
            id: "u1",
            name: "Prod",
            apiBase: "https://prod.test/",
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      }),
    );
    localStorage.setItem(STORAGE_KEYS.activeId, "u1");
    expect(getApiBase()).toBe("https://prod.test/");
  });
});

describe("bootstrapApiBase()", () => {
  it("self-heals a stale activeId to the sentinel", async () => {
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({ version: PRESETS_VERSION, presets: [] }),
    );
    localStorage.setItem(STORAGE_KEYS.activeId, "ghost-id");
    const { bootstrapApiBase } = await import("@/config/api-base");
    bootstrapApiBase();
    expect(localStorage.getItem(STORAGE_KEYS.activeId)).toBe(DEFAULT_PRESET_ID);
  });

  it("does NOT rewrite a valid activeId", async () => {
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({
        version: PRESETS_VERSION,
        presets: [{ id: "u1", name: "x", apiBase: "/api", createdAt: 1, updatedAt: 2 }],
      }),
    );
    localStorage.setItem(STORAGE_KEYS.activeId, "u1");
    const { bootstrapApiBase } = await import("@/config/api-base");
    bootstrapApiBase();
    expect(localStorage.getItem(STORAGE_KEYS.activeId)).toBe("u1");
  });

  it("attaches a storage listener that reloads on activePresetId change", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    const addSpy = vi.spyOn(window, "addEventListener");
    const { bootstrapApiBase } = await import("@/config/api-base");
    bootstrapApiBase();

    const storageCall = addSpy.mock.calls.find((c) => c[0] === "storage");
    expect(storageCall).toBeDefined();
    const handler = storageCall![1] as (e: StorageEvent) => void;

    // Wrong key — no reload.
    handler(new StorageEvent("storage", { key: "simlm.theme", newValue: "dark" }));
    expect(reload).not.toHaveBeenCalled();

    // Right key — reload.
    handler(
      new StorageEvent("storage", {
        key: STORAGE_KEYS.activeId,
        newValue: "u1",
      }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("is idempotent across StrictMode double-invoke (attaches the listener once)", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { bootstrapApiBase } = await import("@/config/api-base");
    bootstrapApiBase();
    bootstrapApiBase();
    const storageCalls = addSpy.mock.calls.filter((c) => c[0] === "storage");
    expect(storageCalls).toHaveLength(1);
  });
});
