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

const { RollbackView } = await import("./RollbackView");

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RollbackView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.apiJson.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<RollbackView>", () => {
  it("Rollback button starts disabled when no filter is set", () => {
    renderView();
    expect(screen.getByRole("button", { name: /Rollback/ })).toBeDisabled();
  });

  it("typing a Batch ID enables the Rollback button", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(screen.getByLabelText("Batch ID"), "42");

    expect(screen.getByRole("button", { name: /Rollback/ })).toBeEnabled();
  });

  it("selecting a Source enables the Rollback button", async () => {
    const user = userEvent.setup();
    renderView();

    await user.selectOptions(screen.getByLabelText("Source"), "llm");

    expect(screen.getByRole("button", { name: /Rollback/ })).toBeEnabled();
  });

  it("clicking Rollback opens ConfirmDialog; confirming POSTs {batch_id}", async () => {
    mocks.apiJson.mockResolvedValueOnce({ affected: 5 });
    const user = userEvent.setup();
    renderView();

    await user.type(screen.getByLabelText("Batch ID"), "42");
    await user.click(screen.getByRole("button", { name: /Rollback/ }));

    // Dialog opens
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Roll back matching pairs?")).toBeInTheDocument();
    // Description renders the summarized filter
    expect(screen.getByText("batch_id=42")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, roll back" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/rollback", {
        method: "POST",
        body: JSON.stringify({ batch_id: 42 }),
      });
    });

    expect(await screen.findByText("5")).toBeInTheDocument();
  });

  it("Cancel closes the ConfirmDialog without firing the mutation", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(screen.getByLabelText("Batch ID"), "9");
    await user.click(screen.getByRole("button", { name: /Rollback/ }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.apiJson).not.toHaveBeenCalled();
  });

  it("submits source + topic combined (empty fields stay out of the payload)", async () => {
    mocks.apiJson.mockResolvedValueOnce({ affected: 3 });
    const user = userEvent.setup();
    renderView();

    await user.selectOptions(screen.getByLabelText("Source"), "llm");
    await user.type(screen.getByLabelText("Topic"), "humor");
    await user.click(screen.getByRole("button", { name: /Rollback/ }));
    await user.click(await screen.findByRole("button", { name: "Yes, roll back" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledWith("/rollback", {
        method: "POST",
        body: JSON.stringify({ source: "llm", topic: "humor" }),
      });
    });
  });
});
