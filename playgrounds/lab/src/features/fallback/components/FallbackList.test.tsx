import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FallbackList } from "./FallbackList";
import type { MissVM } from "@/lib/adapters/view-models";

afterEach(() => cleanup());

const MISSES: MissVM[] = [
  {
    id: 1,
    query: "how to reset my password?",
    count: 12,
    lastSeen: "2026-06-04 09:00",
    source: "chat",
  },
  {
    id: 2,
    query: "export data to csv",
    count: 5,
    lastSeen: "2026-06-03 14:30",
    source: "retrieve",
  },
];

function renderList(overrides: Partial<Parameters<typeof FallbackList>[0]> = {}) {
  const props = {
    misses: MISSES,
    source: "all" as const,
    onSource: vi.fn(),
    onTest: vi.fn(),
    onIngest: vi.fn(),
    ...overrides,
  };
  render(<FallbackList {...props} />);
  return props;
}

test("renders a row per miss with its source chip", () => {
  renderList();
  expect(screen.getByText("how to reset my password?")).toBeInTheDocument();
  expect(screen.getByText("export data to csv")).toBeInTheDocument();
  expect(screen.getByText("2 fallbacks")).toBeInTheDocument();
});

test("clicking a source pill calls onSource", async () => {
  const user = userEvent.setup();
  const { onSource } = renderList();
  await user.click(screen.getByRole("button", { name: /chat/i }));
  expect(onSource).toHaveBeenCalledWith("chat");
});

test("expanding a row reveals a Test button that calls onTest(query)", async () => {
  const user = userEvent.setup();
  const { onTest } = renderList();

  expect(screen.queryByRole("button", { name: /test/i })).toBeNull();

  await user.click(screen.getByText("how to reset my password?"));

  const testBtn = screen.getByRole("button", { name: /test/i });
  expect(testBtn).toBeInTheDocument();

  await user.click(testBtn);
  expect(onTest).toHaveBeenCalledWith("how to reset my password?");
});
