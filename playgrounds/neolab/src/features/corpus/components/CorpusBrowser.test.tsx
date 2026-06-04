import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChunkVM, DocVM, PairVM } from "@/lib/adapters";

const chunkA: ChunkVM = {
  id: "doc_a#c0",
  idx: 0,
  text: "Alpha chunk body text.",
  tokens: null,
  pairs: null,
  page: null,
  heading: "Intro",
  embedded: true,
};
const chunkB: ChunkVM = {
  id: "doc_b#c0",
  idx: 0,
  text: "Beta chunk body text.",
  tokens: null,
  pairs: null,
  page: null,
  heading: null,
  embedded: true,
};
const pair: PairVM = {
  id: 1,
  q: "What is alpha?",
  a: "Alpha is the first.",
  auditStatus: "pass",
  model: null,
  conf: null,
};

const { useChunks, useChunkPairs } = vi.hoisted(() => ({
  useChunks: vi.fn(),
  useChunkPairs: vi.fn(),
}));

vi.mock("@/features/corpus/hooks", () => ({ useChunks, useChunkPairs }));

const { CorpusBrowser } = await import("./CorpusBrowser");

const docs: DocVM[] = [
  {
    id: "doc_a",
    type: "md",
    title: "Alpha Doc",
    source: null,
    status: "indexed",
    chunks: 1,
    pairs: 1,
    tokens: null,
    added: "2026-06-01",
    by: null,
    tags: [],
    error: null,
  },
  {
    id: "doc_b",
    type: "pdf",
    title: "Beta Doc",
    source: null,
    status: "indexed",
    chunks: 1,
    pairs: 0,
    tokens: null,
    added: "2026-06-02",
    by: null,
    tags: [],
    error: null,
  },
];

function renderBrowser() {
  // Chunks depend on the currently-selected docId.
  useChunks.mockImplementation((docId: string | null) => ({
    data: docId === "doc_a" ? [chunkA] : docId === "doc_b" ? [chunkB] : [],
  }));
  useChunkPairs.mockImplementation((chunkId: string | null) => ({
    data: chunkId ? [pair] : [],
  }));
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CorpusBrowser docs={docs} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("changing the selected doc resets the chunk selection", async () => {
  const user = userEvent.setup();
  renderBrowser();

  // Default doc = doc_a (first with chunks). Pane 3 starts empty.
  expect(screen.getByText("Select a chunk")).toBeInTheDocument();

  // Select doc_a's chunk → pane 3 shows its pairs.
  await user.click(screen.getByText("Alpha chunk body text."));
  expect(screen.getByText("What is alpha?")).toBeInTheDocument();
  expect(screen.queryByText("Select a chunk")).toBeNull();

  // Switch to doc_b → chunk selection resets, pane 3 back to empty state.
  await user.click(screen.getByText("Beta Doc"));
  expect(screen.getByText("Select a chunk")).toBeInTheDocument();
  expect(screen.queryByText("What is alpha?")).toBeNull();
});
