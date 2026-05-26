import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { AdminUnanswered } from "@simlm/types";

// Hoisted holder — vi.mock factories run before module imports, so they
// can't close over module-scope variables. Same pattern as apps/web's
// store.test.ts.
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

// Import AFTER vi.mock so the feature module binds to the mocked client.
const { UnansweredView } = await import("@/features/unanswered/UnansweredView");

function renderView() {
  // Per-test QueryClient so cache from one test doesn't leak into the
  // next. retry: false fails fast on test errors (the prod default of
  // retry:1 would double the spy assertions and hide cancellation bugs).
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <UnansweredView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rows: AdminUnanswered[] = [
  {
    id: 1,
    input: "what time is it",
    normalized_input: "what time is it",
    source: "chat",
    count: 7,
    last_seen: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 2,
    input: "summarize this",
    normalized_input: "summarize this",
    source: "llm",
    count: 3,
    last_seen: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  },
];

beforeEach(() => {
  mocks.apiJson.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<UnansweredView>", () => {
  it("renders rows from /unanswered (source 'all', limit 50, offset 0)", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: rows, limit: 50, offset: 0 });
    renderView();

    expect(await screen.findByText("what time is it")).toBeInTheDocument();
    expect(screen.getByText("summarize this")).toBeInTheDocument();
    // 'all' → omitted from URL per buildUnansweredUrl contract
    expect(mocks.apiJson).toHaveBeenCalledWith("/unanswered?limit=50&offset=0");
  });

  it("switching source tab refires the query with ?source=chat", async () => {
    mocks.apiJson.mockResolvedValue({ items: rows, limit: 50, offset: 0 });
    // userEvent (not fireEvent.click) — Radix Tabs respond to pointer
    // events, not synthetic click. fireEvent.click bypasses Radix's
    // RovingFocusGroup activation path; userEvent dispatches the
    // pointerdown/pointerup sequence Radix expects.
    const user = userEvent.setup();
    renderView();
    await screen.findByText("what time is it");

    await user.click(screen.getByRole("tab", { name: "Chat" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/unanswered?source=chat&limit=50&offset=0");
    });
  });

  it("renders the Phase 15 empty-state copy when items is empty", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: [], limit: 50, offset: 0 });
    renderView();
    expect(await screen.findByText("No unanswered yet")).toBeInTheDocument();
    expect(screen.getByText(/Try chatting with the bot/i)).toBeInTheDocument();
  });

  it("clicking row 'Teach' opens the dialog with the row input pre-filled", async () => {
    const user = userEvent.setup();
    mocks.apiJson.mockResolvedValueOnce({ items: rows, limit: 50, offset: 0 });
    renderView();

    const firstRow = (await screen.findByText("what time is it")).closest("tr");
    if (!firstRow) throw new Error("row not found");
    await user.click(within(firstRow as HTMLElement).getByRole("button", { name: "Teach" }));

    expect(await screen.findByText("Teach a reply")).toBeInTheDocument();
    const inputBlock = document.getElementById("teach-input");
    expect(inputBlock?.textContent).toBe("what time is it");
  });
});
