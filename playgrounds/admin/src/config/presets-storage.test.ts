import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PRESET_ID, parsePersistedPresets, PRESETS_VERSION } from "@/config/presets-schema";
import {
  loadActiveId,
  loadPresets,
  savePresets,
  saveActiveId,
  STORAGE_KEYS,
} from "@/config/presets-storage";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  localStorage.clear();
});

describe("parsePersistedPresets", () => {
  it("accepts a well-formed payload", () => {
    const parsed = parsePersistedPresets({
      version: 1,
      presets: [{ id: "u1", name: "Staging", apiBase: "/api", createdAt: 1, updatedAt: 2 }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.presets).toHaveLength(1);
  });

  it("rejects unknown version", () => {
    expect(parsePersistedPresets({ version: 99, presets: [] })).toBeNull();
  });

  it("rejects non-array presets", () => {
    expect(parsePersistedPresets({ version: 1, presets: "nope" })).toBeNull();
  });

  it("rejects entries with missing fields", () => {
    expect(
      parsePersistedPresets({
        version: 1,
        presets: [{ id: "x", name: "y", apiBase: "/api" }],
      }),
    ).toBeNull();
  });
});

describe("loadPresets / savePresets", () => {
  it("returns [] when storage is empty", () => {
    expect(loadPresets()).toEqual([]);
  });

  it("round-trips a list of presets", () => {
    const list = [
      { id: "u1", name: "Staging", apiBase: "/api", createdAt: 1, updatedAt: 2 },
      {
        id: "u2",
        name: "Prod",
        apiBase: "https://prod.test/",
        createdAt: 3,
        updatedAt: 4,
      },
    ];
    savePresets(list);
    expect(loadPresets()).toEqual(list);
  });

  it("returns [] on malformed JSON", () => {
    localStorage.setItem(STORAGE_KEYS.presets, "not json{");
    expect(loadPresets()).toEqual([]);
  });

  it("returns [] and warns on future-incompatible version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify({ version: 99, presets: [] }));
    expect(loadPresets()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("returns [] on shape mismatch without warning (same major version)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify({ version: PRESETS_VERSION, presets: [{ wrong: true }] }),
    );
    expect(loadPresets()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("loadActiveId / saveActiveId", () => {
  it("defaults to the sentinel when empty", () => {
    expect(loadActiveId()).toBe(DEFAULT_PRESET_ID);
  });

  it("round-trips a stored UUID-shaped id", () => {
    saveActiveId("abc-123");
    expect(loadActiveId()).toBe("abc-123");
  });

  it("returns the sentinel when value is an empty string", () => {
    localStorage.setItem(STORAGE_KEYS.activeId, "");
    expect(loadActiveId()).toBe(DEFAULT_PRESET_ID);
  });
});
