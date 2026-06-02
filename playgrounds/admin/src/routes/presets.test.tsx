import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    message: mocks.toastMessage,
  },
}));

// pingBackend is a real network call inside the form; mock it to avoid
// fetches under jsdom. The chip's state isn't asserted by these tests.
vi.mock("@/config/healthcheck", () => ({
  pingBackend: vi.fn().mockResolvedValue({ ok: true, latencyMs: 12 }),
}));

import { PRESETS_VERSION } from "@/config/presets-schema";
import { STORAGE_KEYS } from "@/config/presets-storage";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

function seedStaging() {
  localStorage.setItem(
    STORAGE_KEYS.presets,
    JSON.stringify({
      version: PRESETS_VERSION,
      presets: [
        {
          id: "u1",
          name: "Staging",
          apiBase: "https://staging.test/",
          createdAt: Date.now() - 5 * 60_000,
          updatedAt: Date.now() - 5 * 60_000,
        },
      ],
    }),
  );
}

async function renderRoute() {
  const { default: PresetsRoute } = await import("@/routes/presets");
  return render(<PresetsRoute />);
}

describe("/presets route", () => {
  it("lists Default first with no Delete button, then stored presets", async () => {
    seedStaging();
    await renderRoute();
    const rows = screen.getAllByRole("row");
    // First row is the <thead> row; data rows follow.
    const dataRows = rows.slice(1);
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0]!.textContent).toContain("Default");
    expect(dataRows[1]!.textContent).toContain("Staging");
    // Default row has no Delete button.
    expect(screen.queryByLabelText("Delete preset Default")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Delete preset Staging")).toBeInTheDocument();
  });

  it("clicking 'New preset' opens the dialog in create mode with empty inputs", async () => {
    await renderRoute();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ New preset" }));
    const nameInput = await screen.findByLabelText("Name");
    const apiInput = screen.getByLabelText("API base");
    expect((nameInput as HTMLInputElement).value).toBe("");
    expect((apiInput as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("heading", { name: "New preset" })).toBeInTheDocument();
  });

  it("submitting with a duplicate name shows role=alert and does NOT close the dialog", async () => {
    seedStaging();
    await renderRoute();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ New preset" }));
    const nameInput = await screen.findByLabelText("Name");
    const apiInput = screen.getByLabelText("API base");
    // fireEvent for the value-set (cheap; we don't need each-keystroke
    // behavior). userEvent.click for the submit since Radix Button uses
    // the pointer chain.
    fireEvent.change(nameInput, { target: { value: "Staging" } });
    fireEvent.change(apiInput, { target: { value: "/api" } });
    await user.click(screen.getByRole("button", { name: "Create" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent?.toLowerCase()).toContain("already exists");
    expect(mocks.toastError).toHaveBeenCalled();
    // Dialog still open — heading still in the document.
    expect(screen.getByRole("heading", { name: "New preset" })).toBeInTheDocument();
  });

  it("clicking Edit on a stored row opens the dialog with values pre-filled", async () => {
    seedStaging();
    await renderRoute();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = (await screen.findByLabelText("Name")) as HTMLInputElement;
    const apiInput = screen.getByLabelText("API base") as HTMLInputElement;
    expect(nameInput.value).toBe("Staging");
    expect(apiInput.value).toBe("https://staging.test/");
    expect(screen.getByRole("heading", { name: "Edit preset" })).toBeInTheDocument();
  });

  it("clicking Delete opens ConfirmDialog; confirming removes the row", async () => {
    seedStaging();
    await renderRoute();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Delete preset Staging"));
    await screen.findByRole("heading", { name: "Delete preset?" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.queryByText("Staging")).not.toBeInTheDocument();
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Preset deleted");
  });

  it("deleting the active preset triggers a reload after 500ms", async () => {
    seedStaging();
    localStorage.setItem(STORAGE_KEYS.activeId, "u1");
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    // userEvent setup BEFORE fake timers — userEvent v14 captures
    // setTimeout/setInterval at .setup() time; switching to fake timers
    // afterwards is fine because we only need fake timers around the
    // 500ms post-confirm delay, not around the userEvent click itself.
    const user = userEvent.setup();
    await renderRoute();
    await user.click(screen.getByLabelText("Delete preset Staging"));
    await screen.findByRole("heading", { name: "Delete preset?" });

    vi.useFakeTimers();
    // fireEvent (not userEvent) for the post-fake-timers click —
    // userEvent.click awaits real timers internally and deadlocks
    // under vi.useFakeTimers().
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mocks.toastMessage).toHaveBeenCalledWith("Switched to Default…");
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
