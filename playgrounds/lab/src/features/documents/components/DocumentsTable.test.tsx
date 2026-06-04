import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  q: { data: undefined as unknown, isLoading: false },
  del: { mutate: vi.fn(), isPending: false },
}));
vi.mock("../hooks", () => ({
  useDocuments: () => mocks.q,
  useDeleteDocument: () => mocks.del,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: (p: { children: React.ReactNode }) => <a>{p.children}</a>,
}));

afterEach(() => {
  cleanup();
  mocks.del.mutate.mockClear();
});

it("renders document rows with counts", async () => {
  mocks.q.data = [
    {
      id: "d1",
      title: "Alpha",
      mime_type: "text/markdown",
      created_at: "2026-01-01",
      chunkCount: 3,
      pairCount: 9,
    },
  ];
  const { DocumentsTable } = await import("./DocumentsTable");
  render(<DocumentsTable />);
  expect(screen.getByText("Alpha")).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy();
  expect(screen.getByText("9")).toBeTruthy();
});
it("empty state", async () => {
  mocks.q.data = [];
  const { DocumentsTable } = await import("./DocumentsTable");
  render(<DocumentsTable />);
  expect(screen.getByText(/no documents/i)).toBeTruthy();
});
it("deletes a document after confirming", async () => {
  const user = userEvent.setup();
  mocks.q.data = [
    {
      id: "d1",
      title: "Alpha",
      mime_type: "text/markdown",
      created_at: "2026-01-01",
      chunkCount: 3,
      pairCount: 9,
    },
  ];
  const { DocumentsTable } = await import("./DocumentsTable");
  render(<DocumentsTable />);
  await user.click(screen.getByLabelText("Delete Alpha"));
  await user.click(screen.getByRole("button", { name: "Delete" }));
  expect(mocks.del.mutate).toHaveBeenCalledWith("d1");
});
