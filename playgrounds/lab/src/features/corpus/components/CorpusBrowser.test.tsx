import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  docs: {
    data: [
      { id: "d1", title: "Alpha", mime_type: "", created_at: "", chunkCount: 1, pairCount: 1 },
    ],
  },
  chunks: {
    data: [
      { id: "c1", chunk_index: 0, section_title: "Intro", content: "body", has_embedding: true },
    ],
  },
  pairs: {
    data: [{ id: 1, input: "q", response: "a", audit_status: "pass", has_embedding: true }],
  },
}));
vi.mock("../hooks", () => ({
  useCorpusDocuments: () => mocks.docs,
  useChunks: () => mocks.chunks,
  useChunkPairs: () => mocks.pairs,
}));

afterEach(cleanup);

it("renders documents, their chunks, and a chunk's pairs", async () => {
  const { CorpusBrowser } = await import("./CorpusBrowser");
  render(<CorpusBrowser initialDoc="d1" />);
  expect(screen.getByText("Alpha")).toBeTruthy();
  expect(screen.getByText("Intro")).toBeTruthy();
  expect(screen.getByText(/pass/)).toBeTruthy();
});
