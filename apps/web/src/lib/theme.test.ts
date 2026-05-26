import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyTheme, bootstrapTheme, getStoredTheme, resolveInitialTheme } from "./theme";

describe("theme helper", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("getStoredTheme returns null for empty storage", () => {
    expect(getStoredTheme()).toBeNull();
  });

  it("getStoredTheme returns null for invalid stored values", () => {
    localStorage.setItem("simlm.theme", "neon");
    expect(getStoredTheme()).toBeNull();
  });

  it("applyTheme writes the data-theme attribute and persists to localStorage", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("simlm.theme")).toBe("dark");

    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("simlm.theme")).toBe("light");
  });

  it("resolveInitialTheme honors a stored choice over OS preference", () => {
    localStorage.setItem("simlm.theme", "dark");
    expect(resolveInitialTheme()).toBe("dark");
    localStorage.setItem("simlm.theme", "light");
    expect(resolveInitialTheme()).toBe("light");
  });

  it("bootstrapTheme sets the attribute and returns the resolved theme", () => {
    localStorage.setItem("simlm.theme", "dark");
    const t = bootstrapTheme();
    expect(t).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
