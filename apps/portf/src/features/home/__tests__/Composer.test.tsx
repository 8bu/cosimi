import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// vi.resetModules() in beforeEach is required here because the threads store
// (zustand + persist) is a module-level singleton. Each test that submits
// the form appends a thread to the in-memory state. Without module reset the
// 5th test ("creates a threads entry per submit") sees accumulated state from
// the preceding submit tests instead of a clean slate. This mirrors the same
// pattern used in Task 4's threads store tests.
// The navigateMock must be re-registered after each reset because vi.mock()
// calls are hoisted once per file; re-importing the module picks up the
// mocked version, but the mock registration needs to be live.

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

describe("Composer — submit", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    navigateMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("auto-focuses the input on mount", async () => {
    const { Composer } = await import("../components/Composer");
    render(<Composer />);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("submits on Enter and navigates to /chat/<uuid> with initialPrompt", async () => {
    const { Composer } = await import("../components/Composer");
    render(<Composer />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello world" } });
    fireEvent.submit(input.closest("form")!);

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const call = navigateMock.mock.calls[0]![0];
    expect(call.to).toBe("/chat/$threadId");
    expect(call.params.threadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(call.state).toEqual({ initialPrompt: "hello world" });
  });

  it("does not submit when the input is empty or whitespace", async () => {
    const { Composer } = await import("../components/Composer");
    render(<Composer />);
    const input = screen.getByRole("textbox");
    fireEvent.submit(input.closest("form")!);

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("trims the prompt before sending", async () => {
    const { Composer } = await import("../components/Composer");
    render(<Composer />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  hello  " } });
    fireEvent.submit(input.closest("form")!);

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0]![0].state.initialPrompt).toBe("hello");
  });

  it("creates a threads entry per submit", async () => {
    const { Composer } = await import("../components/Composer");
    const { useThreadsStore } = await import("@/store/threads");
    render(<Composer />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "first" } });
    fireEvent.submit(input.closest("form")!);

    expect(useThreadsStore.getState().threads).toHaveLength(1);
  });
});
