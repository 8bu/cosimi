import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminPair } from "@cosimi/core";

const mocks = vi.hoisted(() => ({
  apiJson: vi.fn() as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/api/client", () => ({
  apiJson: mocks.apiJson,
  ApiError: class ApiError extends Error {
    status = 0;
    body: unknown = null;
  },
}));

const { PairRow } = await import("@/features/pairs/PairRow");

function renderRow(pair: AdminPair) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <table>
        <tbody>
          <PairRow pair={pair} />
        </tbody>
      </table>
    </QueryClientProvider>,
  );
}

const activePair: AdminPair = {
  id: 11,
  input: "hi",
  normalized_input: "hi",
  response: "hello",
  score: 0,
  source: "seed",
  topic: null,
  batch_id: null,
  flagged: false,
  deleted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const deletedPair: AdminPair = {
  ...activePair,
  id: 12,
  deleted_at: new Date().toISOString(),
};

beforeEach(() => {
  mocks.apiJson.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<PairRow>", () => {
  it("clicking Delete on an active row opens ConfirmDialog (no immediate API call)", async () => {
    const user = userEvent.setup();
    renderRow(activePair);

    await user.click(screen.getByRole("button", { name: "Delete pair 11" }));

    // ConfirmDialog gates the destructive action — the API must NOT
    // have been called yet, but the confirm button should be visible.
    expect(mocks.apiJson).not.toHaveBeenCalled();
    expect(await screen.findByText("Delete this pair?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("confirming the delete dialog calls DELETE /pairs/:id", async () => {
    mocks.apiJson.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    renderRow(activePair);

    await user.click(screen.getByRole("button", { name: "Delete pair 11" }));
    // ConfirmDialog renders a "Delete" button (destructive variant).
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/pairs/11", { method: "DELETE" });
    });
  });

  it("cancelling the delete dialog does not call the API", async () => {
    const user = userEvent.setup();
    renderRow(activePair);

    await user.click(screen.getByRole("button", { name: "Delete pair 11" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(mocks.apiJson).not.toHaveBeenCalled();
  });

  it("renders Restore (not Delete) on a soft-deleted row and applies opacity-50", () => {
    renderRow(deletedPair);
    // Restore appears; Delete is hidden.
    expect(screen.getByRole("button", { name: "Restore pair 12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete pair 12" })).not.toBeInTheDocument();
    // Visual: row gets opacity-50 class.
    const tr = screen.getByRole("button", { name: "Restore pair 12" }).closest("tr");
    expect(tr?.className).toMatch(/opacity-50/);
  });

  it("clicking Restore on a deleted row calls POST /pairs/:id/restore", async () => {
    mocks.apiJson.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    renderRow(deletedPair);

    await user.click(screen.getByRole("button", { name: "Restore pair 12" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/pairs/12/restore", { method: "POST" });
    });
  });
});
