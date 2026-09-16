import { afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentsTable } from "@/features/documents/components/DocumentsTable";
import type { DocVM } from "@/lib/adapters";

afterEach(() => cleanup());

const docs: DocVM[] = [
  {
    id: "a",
    type: "md",
    title: "Alpha",
    source: null,
    status: "indexed",
    chunks: 4,
    pairs: 2,
    tokens: null,
    added: "2026-06-01",
    by: null,
    tags: [],
    error: null,
  },
  {
    id: "b",
    type: "pdf",
    title: "Beta",
    source: null,
    status: "indexed",
    chunks: 9,
    pairs: 5,
    tokens: null,
    added: "2026-06-02",
    by: null,
    tags: [],
    error: null,
  },
];

const noop = () => {};

test("search filters rows", async () => {
  const user = userEvent.setup();
  render(<DocumentsTable docs={docs} onOpen={noop} onIngest={noop} onRemove={noop} />);
  await user.type(screen.getByPlaceholderText(/search title/i), "alpha");
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(screen.queryByText("Beta")).toBeNull();
});

test("tokens null renders em dash", () => {
  render(<DocumentsTable docs={docs} onOpen={noop} onIngest={noop} onRemove={noop} />);
  // both rows have null tokens → at least two em-dashes in the table
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});

test("row click opens the document", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<DocumentsTable docs={docs} onOpen={onOpen} onIngest={noop} onRemove={noop} />);
  await user.click(screen.getByText("Alpha"));
  expect(onOpen).toHaveBeenCalledWith("a");
});

test("selecting a row reveals a Remove-only bulk bar that calls onRemove", async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn();
  render(<DocumentsTable docs={docs} onOpen={noop} onIngest={noop} onRemove={onRemove} />);
  // select Alpha's row via its row checkbox (sort-order independent)
  const alphaRow = screen.getByText("Alpha").closest("tr")!;
  await user.click(alphaRow.querySelector(".ck")!);
  expect(screen.getByText("selected")).toBeInTheDocument();
  // no Re-ingest / Re-embed controls exist
  expect(screen.queryByRole("button", { name: /re-ingest/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /re-embed/i })).toBeNull();
  await user.click(screen.getByRole("button", { name: /remove/i }));
  expect(onRemove).toHaveBeenCalledWith(["a"]);
});
