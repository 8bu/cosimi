import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TYPING_ANIM_MS_PER_CHAR, AUTO_SUBMIT_DELAY_MS } from "../tokens";

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

describe("Composer - submit", () => {
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

describe("Composer - chip animation", () => {
  beforeEach(() => {
    localStorage.clear();
    navigateMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("types chip text character-by-character then auto-submits", async () => {
    const { Composer } = await import("../components/Composer");
    const { createRef } = await import("react");

    const ref = createRef<import("../components/Composer").ComposerHandle>();
    render(<Composer ref={ref} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    ref.current!.runChipAnimation("Best");

    // 4 chars * 40ms per char = 160ms typing, then 250ms before submit.
    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR * 4);
    expect(input.value).toBe("Best");
    expect(navigateMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTO_SUBMIT_DELAY_MS);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0]![0].state.initialPrompt).toBe("Best");
  });

  it("keydown of a non-modifier key cancels the animation (no submit, typed-so-far preserved)", async () => {
    const { Composer } = await import("../components/Composer");
    const { createRef } = await import("react");

    const ref = createRef<import("../components/Composer").ComposerHandle>();
    render(<Composer ref={ref} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    ref.current!.runChipAnimation("Best project");

    // Advance enough to type "Bes" (3 chars).
    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR * 3);
    expect(input.value).toBe("Bes");

    // Cancel via a real keydown.
    fireEvent.keyDown(input, { key: "a" });

    // Advance well past the remaining typing + auto-submit window.
    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR * 20 + AUTO_SUBMIT_DELAY_MS);

    expect(navigateMock).not.toHaveBeenCalled();
    expect(input.value).toBe("Bes"); // typed-so-far preserved
  });

  it("keydown of a pure modifier key does NOT cancel", async () => {
    const { Composer } = await import("../components/Composer");
    const { createRef } = await import("react");

    const ref = createRef<import("../components/Composer").ComposerHandle>();
    render(<Composer ref={ref} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    ref.current!.runChipAnimation("Best");
    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR);

    fireEvent.keyDown(input, { key: "Shift" });
    fireEvent.keyDown(input, { key: "Control" });
    fireEvent.keyDown(input, { key: "Meta" });
    fireEvent.keyDown(input, { key: "Alt" });
    fireEvent.keyDown(input, { key: "Tab" });

    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR * 4 + AUTO_SUBMIT_DELAY_MS);

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("Escape cancels the animation", async () => {
    const { Composer } = await import("../components/Composer");
    const { createRef } = await import("react");

    const ref = createRef<import("../components/Composer").ComposerHandle>();
    render(<Composer ref={ref} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    ref.current!.runChipAnimation("Best");
    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR * 2);

    fireEvent.keyDown(input, { key: "Escape" });

    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR * 4 + AUTO_SUBMIT_DELAY_MS);

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("a second runChipAnimation cancels the first and starts fresh", async () => {
    const { Composer } = await import("../components/Composer");
    const { createRef } = await import("react");

    const ref = createRef<import("../components/Composer").ComposerHandle>();
    render(<Composer ref={ref} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    ref.current!.runChipAnimation("Best project");
    await vi.advanceTimersByTimeAsync(TYPING_ANIM_MS_PER_CHAR * 3);
    expect(input.value).toBe("Bes");

    ref.current!.runChipAnimation("Stack");
    await vi.advanceTimersByTimeAsync(
      TYPING_ANIM_MS_PER_CHAR * "Stack".length + AUTO_SUBMIT_DELAY_MS,
    );

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0]![0].state.initialPrompt).toBe("Stack");
  });
});
