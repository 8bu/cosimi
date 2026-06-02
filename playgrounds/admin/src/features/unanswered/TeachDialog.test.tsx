import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
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

const { TeachDialog } = await import("@/features/unanswered/TeachDialog");

function renderDialog(input = "what time is it") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TeachDialog open onOpenChange={() => {}} input={input} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.apiJson.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<TeachDialog>", () => {
  it("POSTs to /pairs with input, response, source:'user' on submit", async () => {
    mocks.apiJson.mockResolvedValueOnce({ id: 42 });
    renderDialog("what time is it");

    const textarea = screen.getByLabelText("Response");
    fireEvent.change(textarea, { target: { value: "It is 3pm in São Paulo." } });

    fireEvent.click(screen.getByRole("button", { name: "Teach" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalledTimes(1);
    });
    const [path, opts] = mocks.apiJson.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/pairs");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(String(opts.body));
    expect(body).toEqual({
      input: "what time is it",
      response: "It is 3pm in São Paulo.",
      source: "user",
    });
    // topic omitted because empty (.trim() || undefined)
    expect(body.topic).toBeUndefined();
  });

  it("includes topic when set", async () => {
    mocks.apiJson.mockResolvedValueOnce({ id: 1 });
    renderDialog("hi");

    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "hello" } });
    fireEvent.change(screen.getByLabelText("Topic (optional)"), { target: { value: "greeting" } });
    fireEvent.click(screen.getByRole("button", { name: "Teach" }));

    await waitFor(() => {
      expect(mocks.apiJson).toHaveBeenCalled();
    });
    const body = JSON.parse(String((mocks.apiJson.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.topic).toBe("greeting");
  });

  it("submit disabled until response has non-whitespace content", () => {
    renderDialog();
    const submit = screen.getByRole("button", { name: "Teach" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "  " } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "ok" } });
    expect(submit).not.toBeDisabled();
  });

  it("renders an error message when the mutation rejects", async () => {
    mocks.apiJson.mockRejectedValueOnce(new Error("500 Internal Server Error"));
    renderDialog();

    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Teach" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("500 Internal Server Error");
  });
});
