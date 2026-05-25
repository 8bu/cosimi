import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

// useImport calls plain fetch (NOT apiJson) because the body is a File
// and the content-type header discriminates server-side. Stub the global
// fetch to capture the call.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { ImportView } = await import("./ImportView");

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ImportView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("<ImportView>", () => {
  it("POSTs the file with application/x-ndjson for .jsonl, shows success card with batch link", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ batch_id: 42, count: 5 }));
    const user = userEvent.setup();
    renderView();

    const file = new File(
      [
        '{"input":"hi","response":"hello"}\n{"input":"yo","response":"sup"}\n{"input":"q3","response":"a3"}\n{"input":"q4","response":"a4"}\n{"input":"q5","response":"a5"}',
      ],
      "batch.jsonl",
      { type: "application/x-ndjson" },
    );
    await user.upload(screen.getByLabelText("File"), file);
    // Default source = 'llm', no topic — keep it minimal.
    await user.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/import?source=llm");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/x-ndjson");
    expect(init.body).toBe(file);

    // Success card with batch link.
    expect(await screen.findByText("#42")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View rows" });
    expect(link).toHaveAttribute("href", "/pairs?batch_id=42");
  });

  it("POSTs application/json for .json files and forwards the topic param", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ batch_id: 7, count: 1 }));
    const user = userEvent.setup();
    renderView();

    const file = new File(['[{"input":"x","response":"y"}]'], "seed.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText("File"), file);
    await user.selectOptions(screen.getByLabelText("Source"), "seed");
    await user.type(screen.getByLabelText("Topic"), "greetings");
    await user.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/import?source=seed&topic=greetings");
    expect(init.headers["content-type"]).toBe("application/json");
  });

  it("renders the server error message when the import fails (400)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid body" }, 400));
    const user = userEvent.setup();
    renderView();

    const file = new File(['[{"missing":"response"}]'], "bad.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("File"), file);
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid body");
  });

  it("Import button stays disabled until a file is chosen", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });
});
