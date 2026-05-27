import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("preferences store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults primaryLocale to 'en'", async () => {
    const { usePreferencesStore } = await import("../preferences");
    expect(usePreferencesStore.getState().primaryLocale).toBe("en");
  });

  it("setPrimaryLocale updates state", async () => {
    const { usePreferencesStore } = await import("../preferences");
    usePreferencesStore.getState().setPrimaryLocale("vi");
    expect(usePreferencesStore.getState().primaryLocale).toBe("vi");
  });

  it("persists primaryLocale to localStorage under key 'portf.preferences'", async () => {
    const { usePreferencesStore } = await import("../preferences");
    usePreferencesStore.getState().setPrimaryLocale("vi");

    const raw = localStorage.getItem("portf.preferences");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.primaryLocale).toBe("vi");
  });
});
