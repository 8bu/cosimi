import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { AdminTeachQueueItem } from "@simlm/types";

// Hoisted holder — vi.mock factories run before module imports, so they
// can't close over module-scope vars. Same pattern as
// UnansweredView.test.tsx + apps/web's store.test.ts.
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

const { TeachQueueView } = await import("@/features/teach-queue/TeachQueueView");

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TeachQueueView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseRow: AdminTeachQueueItem = {
  id: 1,
  input: "what is the meaning of life",
  response: "42",
  topic: null,
  submitted_by_session: "abcdef0123456789",
  status: "pending",
  flagged: false,
  flag_reason: null,
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
};

const rows: AdminTeachQueueItem[] = [
  baseRow,
  { ...baseRow, id: 2, input: "what time is it", response: "time to refactor" },
];

beforeEach(() => {
  mocks.apiJson.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<TeachQueueView>", () => {
  it("loads pending rows by default with the correct URL", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: rows, limit: 50, offset: 0 });
    renderView();

    expect(await screen.findByText("what is the meaning of life")).toBeInTheDocument();
    expect(mocks.apiJson).toHaveBeenCalledWith("/teach-queue?status=pending&limit=50&offset=0");
  });

  it("switching tab to Approved refires with ?status=approved and hides checkboxes", async () => {
    mocks.apiJson.mockResolvedValue({ items: rows, limit: 50, offset: 0 });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("what is the meaning of life");

    // Sanity: pending shows the "Select all on page" checkbox in the
    // header. userEvent + Radix Tabs pointer events (vs fireEvent).
    expect(screen.getByLabelText("Select all on page")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Approved" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/teach-queue?status=approved&limit=50&offset=0");
    });
    // Checkbox column disappears for non-pending statuses.
    expect(screen.queryByLabelText("Select all on page")).not.toBeInTheDocument();
  });

  it("checking a row reveals the bulk action bar", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: rows, limit: 50, offset: 0 });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("what is the meaning of life");

    // No bar before any selection.
    expect(screen.queryByText("Approve all")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Select submission 1"));

    const approveAll = await screen.findByText("Approve all");
    // The count + "selected" label live in two child nodes (<span>1</span>
    // + raw text " selected"). Walk up to the bar container and assert
    // on its concatenated text.
    const bar = approveAll.closest("div.flex.items-center.justify-between");
    expect(bar).not.toBeNull();
    expect(bar!.textContent).toContain("1 selected");
  });

  it("renders empty-state row when items is empty", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: [], limit: 50, offset: 0 });
    renderView();
    expect(await screen.findByText("Nothing in this status.")).toBeInTheDocument();
  });
});
