import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ q: { data: undefined as unknown, isLoading: false } }));
vi.mock("../hooks", () => ({ useFallback: () => mocks.q }));
afterEach(cleanup);

it("lists retrieval misses with counts", async () => {
  mocks.q.data = [
    { id: 1, input: "what is foo", source: "retrieve", count: 4, last_seen: "2026-01-01" },
  ];
  const { FallbackList } = await import("./FallbackList");
  render(<FallbackList />);
  expect(screen.getByText("what is foo")).toBeTruthy();
  expect(screen.getByText(/4/)).toBeTruthy();
});
it("empty state", async () => {
  mocks.q.data = [];
  const { FallbackList } = await import("./FallbackList");
  render(<FallbackList />);
  expect(screen.getByText(/no retrieval misses/i)).toBeTruthy();
});
