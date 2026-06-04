import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetrieveWorkbench } from "./RetrieveWorkbench";
import { useRetrieveStore } from "../store";
import type { DocVM, HitVM, RetrieveVM } from "@/lib/adapters";

const docs: DocVM[] = [
  {
    id: "doc_1",
    type: "md",
    title: "API Auth",
    source: null,
    status: "indexed",
    chunks: 3,
    pairs: 2,
    tokens: null,
    added: "2026-06-01",
    by: null,
    tags: [],
    error: null,
  },
];

const hit: HitVM = {
  rank: 1,
  kind: "pair",
  score: 0.912,
  docId: "doc_1",
  docTitle: "API Auth",
  chunkId: "doc_1#c0",
  text: "tokens expire after 3600 seconds",
  page: null,
  vec: 0.912,
  lex: null,
  answer: "3600 seconds.",
  neighbors: [],
  pairs: [{ q: "How long do tokens last?", a: "3600 seconds." }],
};

const vm: RetrieveVM = {
  query: "tokens",
  tookMs: 120,
  hits: [hit],
  answer: { text: "3600 seconds.", cite: 1 },
};

function seedStore(partial?: Partial<ReturnType<typeof useRetrieveStore.getState>>) {
  useRetrieveStore.setState({ result: vm, isLoading: false, activeHit: null, ...partial });
}

afterEach(() => {
  cleanup();
  useRetrieveStore.setState({ result: null, activeHit: null, isLoading: false });
});

test("renders the grounded answer text", () => {
  seedStore();
  render(<RetrieveWorkbench docs={docs} />);
  expect(screen.getByText("Grounded answer")).toBeInTheDocument();
  expect(screen.getByText(/3600 seconds\./)).toBeInTheDocument();
});

test("hit card shows the score to 3 decimals", () => {
  seedStore();
  render(<RetrieveWorkbench docs={docs} />);
  expect(screen.getByText("0.912")).toBeInTheDocument();
});

test("clicking a hit sets the active hit in the store", async () => {
  const user = userEvent.setup();
  const setActiveHit = vi.fn();
  seedStore({ setActiveHit });
  render(<RetrieveWorkbench docs={docs} />);

  await user.click(screen.getByText("tokens expire after 3600 seconds"));
  expect(setActiveHit).toHaveBeenCalledWith(hit);
});

test("hybrid and lexical mode buttons are disabled; vector is active", () => {
  seedStore();
  render(<RetrieveWorkbench docs={docs} />);
  expect(screen.getByRole("button", { name: "hybrid" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "lexical" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "vector" })).not.toBeDisabled();
});
