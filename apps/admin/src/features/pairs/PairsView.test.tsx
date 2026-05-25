import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
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

const { PairsView } = await import("@/features/pairs/PairsView");

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PairsView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pairs: AdminPair[] = [
  {
    id: 1,
    input: "hello",
    normalized_input: "hello",
    response: "hi there",
    score: 3,
    source: "seed",
    topic: "greetings",
    batch_id: null,
    flagged: false,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    input: "how are you",
    normalized_input: "how are you",
    response: "doing fine",
    score: 0,
    source: "chat",
    topic: null,
    batch_id: null,
    flagged: false,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

beforeEach(() => {
  mocks.apiJson.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<PairsView>", () => {
  it("renders pairs with the baseline /pairs?limit=50&offset=0 URL (no filters)", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: pairs, limit: 50, offset: 0 });
    renderView();

    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(screen.getByText("how are you")).toBeInTheDocument();
    expect(mocks.apiJson).toHaveBeenCalledWith("/pairs?limit=50&offset=0");
  });

  it("typing in search refires with ?q= after the debounce window", async () => {
    mocks.apiJson.mockResolvedValue({ items: pairs, limit: 50, offset: 0 });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("hello");

    await user.type(screen.getByLabelText("Search"), "hel");

    // Debounce is 250ms — userEvent.type fires keystrokes synchronously
    // but the timer fires under jsdom's real clock. waitFor polls until
    // the debounced effect lands.
    await waitFor(
      () => {
        expect(mocks.apiJson).toHaveBeenCalledWith("/pairs?q=hel&limit=50&offset=0");
      },
      { timeout: 1500 },
    );
  });

  it("checking 'Include deleted' refires with ?include_deleted=true", async () => {
    mocks.apiJson.mockResolvedValue({ items: pairs, limit: 50, offset: 0 });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("hello");

    await user.click(screen.getByLabelText("Include deleted"));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/pairs?include_deleted=true&limit=50&offset=0");
    });
  });

  it("changing source to 'Seed' refires with ?source=seed (no debounce on enum)", async () => {
    mocks.apiJson.mockResolvedValue({ items: pairs, limit: 50, offset: 0 });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("hello");

    await user.selectOptions(screen.getByLabelText("Source"), "seed");

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/pairs?source=seed&limit=50&offset=0");
    });
  });

  it("renders 'No matches.' when items is empty", async () => {
    mocks.apiJson.mockResolvedValueOnce({ items: [], limit: 50, offset: 0 });
    renderView();
    expect(await screen.findByText("No matches.")).toBeInTheDocument();
  });
});
