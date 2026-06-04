import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  ingest: { mutate: vi.fn(), isPending: false },
  job: { data: undefined as unknown },
  key: { value: "sk-test" },
}));
vi.mock("../hooks", () => ({
  useIngest: () => mocks.ingest,
  useIngestJob: () => mocks.job,
}));
vi.mock("@/config/anthropic-key", () => ({
  getAnthropicKey: () => mocks.key.value,
  setAnthropicKey: (v: string) => {
    mocks.key.value = v;
  },
}));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  mocks.ingest.mutate.mockReset();
  mocks.job.data = undefined;
  mocks.key.value = "sk-test";
});

it("submits a pasted doc", async () => {
  const { IngestForm } = await import("./IngestForm");
  const user = userEvent.setup();
  render(wrap(<IngestForm />));
  await user.type(screen.getByLabelText("Title"), "Doc");
  await user.type(screen.getByLabelText("Content"), "## A\nbody.");
  await user.click(screen.getByRole("button", { name: /ingest/i }));
  expect(mocks.ingest.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "paste", title: "Doc" }),
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
});

it("disables submit without an api key", async () => {
  mocks.key.value = "";
  const { IngestForm } = await import("./IngestForm");
  const user = userEvent.setup();
  render(wrap(<IngestForm />));
  await user.type(screen.getByLabelText("Title"), "Doc");
  await user.type(screen.getByLabelText("Content"), "## A\nbody.");
  expect((screen.getByRole("button", { name: /ingest/i }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

it("renders job progress while a job is active", async () => {
  mocks.job.data = {
    id: "j1",
    title: "Doc",
    status: "running",
    stage: "generating",
    chunksTotal: 4,
    chunksDone: 2,
    pairsGenerated: 6,
    pairsAudited: 0,
    pairsPassed: 0,
    documentId: null,
    error: null,
    createdAt: "",
    updatedAt: "",
  };
  const { IngestForm } = await import("./IngestForm");
  render(wrap(<IngestForm />));
  expect(screen.getByText(/generating q&a pairs/i)).toBeTruthy();
  expect(screen.getByText("Generated 6")).toBeTruthy();
});
