import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(overrides: { destructive?: boolean; onConfirm?: () => void } = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = overrides.onConfirm ?? vi.fn();
  render(
    <ConfirmDialog
      open={true}
      onOpenChange={onOpenChange}
      title="Are you sure?"
      destructive={overrides.destructive}
      onConfirm={onConfirm}
      confirmLabel={overrides.destructive ? "Yes, delete" : undefined}
    >
      This action cannot be undone.
    </ConfirmDialog>,
  );
  return { onOpenChange, onConfirm };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<ConfirmDialog>", () => {
  it("Cancel closes the dialog without firing onConfirm", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Confirm fires onConfirm exactly once", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ destructive: true });

    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders the DialogDescription for a11y (Radix would warn otherwise)", () => {
    renderDialog();
    // DialogDescription renders the children inside a <p>; we assert on
    // the literal text presence rather than the specific tag.
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("uses 'Delete' as the default confirm label when destructive and no override", async () => {
    render(
      <ConfirmDialog open={true} onOpenChange={vi.fn()} title="x" destructive onConfirm={vi.fn()}>
        body
      </ConfirmDialog>,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
