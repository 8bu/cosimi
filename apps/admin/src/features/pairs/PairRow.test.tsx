import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminPair } from "@simlm/types";

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
  it("clicking Delete on an active row calls DELETE /pairs/:id", async () => {
    mocks.apiJson.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    renderRow(activePair);

    await user.click(screen.getByRole("button", { name: "Delete pair 11" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/pairs/11", { method: "DELETE" });
    });
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
