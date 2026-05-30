import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ThreadIndexEntry } from "@/store/threads";

const { navigateMock, renameMock, removeMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  renameMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({}),
}));

vi.mock("@/store/threads", () => ({
  useThreadsStore: Object.assign(
    (sel: (s: { rename: typeof renameMock; remove: typeof removeMock }) => unknown) =>
      sel({ rename: renameMock, remove: removeMock }),
    { getState: () => ({ rename: renameMock, remove: removeMock }) },
  ),
}));

const entry: ThreadIndexEntry = { id: "t1", ts: Date.now(), title: "hello world" };

describe("ThreadRow", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    renameMock.mockReset();
    removeMock.mockReset();
  });

  it("renders title + meta", async () => {
    const { ThreadRow } = await import("@/features/sidebar/components/ThreadRow");
    render(<ThreadRow entry={entry} />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.getByText(/now|^\d+[mhd]$/)).toBeInTheDocument();
  });

  it("navigates on row click", async () => {
    const { ThreadRow } = await import("@/features/sidebar/components/ThreadRow");
    const { container } = render(<ThreadRow entry={entry} />);
    fireEvent.click(container.querySelector(".v1-thread")!);
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/chat/$threadId",
      params: { threadId: "t1" },
      search: { artifact: undefined },
    });
  });

  it("double-click label enters edit mode + Enter commits rename", async () => {
    const { ThreadRow } = await import("@/features/sidebar/components/ThreadRow");
    render(<ThreadRow entry={entry} />);
    fireEvent.doubleClick(screen.getByText("hello world"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(renameMock).toHaveBeenCalledWith("t1", "renamed");
  });

  it("Esc in edit mode cancels without renaming", async () => {
    const { ThreadRow } = await import("@/features/sidebar/components/ThreadRow");
    render(<ThreadRow entry={entry} />);
    fireEvent.doubleClick(screen.getByText("hello world"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(renameMock).not.toHaveBeenCalled();
  });

  it("× button confirms then removes; navigation propagation suppressed", async () => {
    window.confirm = vi.fn(() => true);
    const { ThreadRow } = await import("@/features/sidebar/components/ThreadRow");
    render(<ThreadRow entry={entry} />);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(removeMock).toHaveBeenCalledWith("t1");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("× button respects confirm=false", async () => {
    window.confirm = vi.fn(() => false);
    const { ThreadRow } = await import("@/features/sidebar/components/ThreadRow");
    render(<ThreadRow entry={entry} />);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(removeMock).not.toHaveBeenCalled();
  });
});
