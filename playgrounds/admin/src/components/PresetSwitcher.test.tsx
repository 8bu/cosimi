import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Sonner is mocked at the import boundary — assert on the toast.message
// call shape, not on DOM portals (Phase 15 sonner-test discipline).
const mocks = vi.hoisted(() => ({
  toastMessage: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    message: mocks.toastMessage,
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { PRESETS_VERSION } from "@/config/presets-schema";
import { STORAGE_KEYS } from "@/config/presets-storage";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

function seedTwoPresets() {
  localStorage.setItem(
    STORAGE_KEYS.presets,
    JSON.stringify({
      version: PRESETS_VERSION,
      presets: [
        { id: "u1", name: "Staging", apiBase: "/api", createdAt: 1, updatedAt: 2 },
        {
          id: "u2",
          name: "Prod",
          apiBase: "https://prod.test/",
          createdAt: 3,
          updatedAt: 4,
        },
      ],
    }),
  );
}

describe("<PresetSwitcher>", () => {
  it("renders Default first, then stored presets in document order", async () => {
    seedTwoPresets();
    const { PresetSwitcher } = await import("@/components/PresetSwitcher");
    render(<PresetSwitcher />);
    const options = screen.getAllByRole("option").map((o) => (o as HTMLOptionElement).textContent);
    expect(options).toEqual(["Default (build-time)", "Staging", "Prod"]);
  });

  it("reflects activeId as the select's value", async () => {
    seedTwoPresets();
    localStorage.setItem(STORAGE_KEYS.activeId, "u2");
    const { PresetSwitcher } = await import("@/components/PresetSwitcher");
    render(<PresetSwitcher />);
    const select = screen.getByLabelText("Active backend") as HTMLSelectElement;
    expect(select.value).toBe("u2");
  });

  it("changing select toasts and reloads after 500ms", async () => {
    seedTwoPresets();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    const { PresetSwitcher } = await import("@/components/PresetSwitcher");
    render(<PresetSwitcher />);

    const select = screen.getByLabelText("Active backend") as HTMLSelectElement;
    // fireEvent (not userEvent) because the test uses fake timers and
    // userEvent.selectOptions internally awaits real timers, which
    // deadlocks. The synthetic change event is sufficient — the only
    // listener is the React onChange handler, no Radix pointer chain.
    fireEvent.change(select, { target: { value: "u1" } });

    expect(mocks.toastMessage).toHaveBeenCalledWith("Switching to Staging…");
    expect(reload).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("selecting the already-active option is a no-op (no toast, no reload)", async () => {
    seedTwoPresets();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    const { PresetSwitcher } = await import("@/components/PresetSwitcher");
    render(<PresetSwitcher />);

    const select = screen.getByLabelText("Active backend") as HTMLSelectElement;
    // Default is the seeded activeId (sentinel via empty key).
    fireEvent.change(select, { target: { value: "__default__" } });
    vi.advanceTimersByTime(500);
    expect(mocks.toastMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
