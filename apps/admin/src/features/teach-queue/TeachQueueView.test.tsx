import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { AdminTeachQueueItem } from "@cosimi/types";

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

  it("prunes selected ids that no longer exist after a refetch", async () => {
    // First load: 2 rows. Select both. Then a refetch returns only row 2 —
    // simulates row 1 being rejected via its per-row button. The bulk bar
    // should drop to "1 selected", not stay stale at "2 selected".
    mocks.apiJson
      .mockResolvedValueOnce({ items: rows, limit: 50, offset: 0 })
      .mockResolvedValueOnce({ items: rows.slice(1), limit: 50, offset: 0 });
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const utils = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TeachQueueView />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText("what is the meaning of life");

    await user.click(screen.getByLabelText("Select submission 1"));
    await user.click(screen.getByLabelText("Select submission 2"));
    const beforeBar = (await screen.findByText("Approve all")).closest(
      "div.flex.items-center.justify-between",
    );
    expect(beforeBar!.textContent).toContain("2 selected");

    // Force a refetch by invalidating the cache.
    qc.invalidateQueries({ queryKey: ["admin", "teach-queue"] });
    await waitFor(() => {
      expect(screen.queryByText("what is the meaning of life")).not.toBeInTheDocument();
    });

    // Bar should still be visible (submission 2 still selected) and now read "1 selected".
    const afterBar = (await screen.findByText("Approve all")).closest(
      "div.flex.items-center.justify-between",
    );
    expect(afterBar!.textContent).toContain("1 selected");
    utils.unmount();
  });

  it("renders empty-state row with Phase 15 copy when items is empty", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: [], limit: 50, offset: 0 });
    renderView();
    expect(await screen.findByText("Teach queue is empty")).toBeInTheDocument();
    expect(screen.getByText(/When chat users send \/teach <reply>/i)).toBeInTheDocument();
  });

  it("j/k keyboard nav moves focus highlight; `a` approves the focused row", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: rows, limit: 50, offset: 0 });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("what is the meaning of life");

    // Section must be focused for the scoped keydown listener to fire.
    // The section is the outermost <section> with the focus-ring class —
    // userEvent.tab() would step through the first focusable child;
    // explicit focus() is faster and matches the production "operator
    // clicked into the queue" flow.
    const section = screen
      .getByText("what is the meaning of life")
      .closest("section") as HTMLElement;
    section.focus();

    // j → activeIdx 0 → 1
    await user.keyboard("j");
    // The second row's <tr> now has the focus-highlight class.
    const row2Cell = screen.getByText("what time is it");
    const row2Tr = row2Cell.closest("tr") as HTMLElement;
    await waitFor(() => {
      expect(row2Tr.className).toMatch(/ring-primary\/30/);
    });

    // `a` approves the focused row → POST /teach-queue/2/approve.
    mocks.apiJson.mockResolvedValueOnce({ pair_id: 99 });
    await user.keyboard("a");
    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/teach-queue/2/approve", { method: "POST" });
    });
  });

  it("ignores j/k keystrokes when focus is in an input (suppression rule)", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: rows, limit: 50, offset: 0 });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("what is the meaning of life");

    // Simulate focus in a free-form input by appending one to the document.
    // The shortcut suppressor checks document.activeElement.tagName === INPUT.
    const probe = document.createElement("input");
    document.body.appendChild(probe);
    probe.focus();
    await user.keyboard("j");
    // `a` would have approved a row — verify no API call fired.
    await user.keyboard("a");
    expect(mocks.apiJson).toHaveBeenCalledTimes(1); // only the initial list call
    document.body.removeChild(probe);
  });
});
