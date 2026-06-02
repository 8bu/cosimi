import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

const { RejectDialog } = await import("@/features/teach-queue/RejectDialog");

function renderDialog(ids: number[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenChange = vi.fn();
  const result = render(
    <QueryClientProvider client={qc}>
      <RejectDialog open={true} onOpenChange={onOpenChange} ids={ids} />
    </QueryClientProvider>,
  );
  return { ...result, onOpenChange };
}

beforeEach(() => {
  mocks.apiJson.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<RejectDialog>", () => {
  it("single-id path POSTs to /teach-queue/:id/reject with the reviewer note", async () => {
    mocks.apiJson.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    renderDialog([42]);

    await user.type(screen.getByLabelText("Reviewer note (optional)"), "off-topic");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/teach-queue/42/reject", {
        method: "POST",
        body: JSON.stringify({ reviewer_note: "off-topic" }),
      });
    });
  });

  it("single-id path omits reviewer_note when the textarea is blank", async () => {
    mocks.apiJson.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    renderDialog([7]);

    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/teach-queue/7/reject", {
        method: "POST",
        body: JSON.stringify({ reviewer_note: undefined }),
      });
    });
  });

  it("multi-id path POSTs to /teach-queue/batch with action 'reject'", async () => {
    mocks.apiJson.mockResolvedValueOnce({ rejected: 3 });
    const user = userEvent.setup();
    renderDialog([1, 2, 3]);

    await user.type(screen.getByLabelText("Reviewer note (optional)"), "noisy batch");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/teach-queue/batch", {
        method: "POST",
        body: JSON.stringify({
          ids: [1, 2, 3],
          action: "reject",
          reviewer_note: "noisy batch",
        }),
      });
    });
  });

  it("pluralizes the title based on ids length", () => {
    renderDialog([1]);
    expect(screen.getByText("Reject 1 submission")).toBeInTheDocument();
    // Re-render with a multi count by remounting.
    renderDialog([1, 2]);
    expect(screen.getByText("Reject 2 submissions")).toBeInTheDocument();
  });
});
