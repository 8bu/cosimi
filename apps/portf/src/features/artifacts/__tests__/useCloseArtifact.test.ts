import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";

let mockPathname = "/chat/abc";
let mockHistoryLength = 5;
const navigate = vi.fn();
const back = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (arg?: { select?: (s: { location: { pathname: string } }) => string }) =>
    arg?.select ? arg.select({ location: { pathname: mockPathname } }) : mockPathname,
  useRouter: () => ({
    navigate,
    history: { back },
  }),
}));

beforeEach(() => {
  navigate.mockReset();
  back.mockReset();
  Object.defineProperty(window, "history", {
    configurable: true,
    value: { length: mockHistoryLength },
  });
});

afterEach(() => {
  cleanup();
});

describe("useCloseArtifact", () => {
  it("calls router.history.back() on /chat with history", async () => {
    mockPathname = "/chat/abc";
    mockHistoryLength = 5;
    const { useCloseArtifact } = await import("@/features/artifacts/hooks/useCloseArtifact");
    const { result } = renderHook(() => useCloseArtifact());
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("calls navigate('/chat') on standalone with no history (length=1)", async () => {
    mockPathname = "/artifact/projects/wegopro";
    mockHistoryLength = 1;
    Object.defineProperty(window, "history", {
      configurable: true,
      value: { length: 1 },
    });
    vi.resetModules();
    const { useCloseArtifact } = await import("@/features/artifacts/hooks/useCloseArtifact");
    const { result } = renderHook(() => useCloseArtifact());
    act(() => result.current.close());
    expect(navigate).toHaveBeenCalledWith({ to: "/chat" });
    expect(back).not.toHaveBeenCalled();
  });

  it("calls router.history.back() on standalone WITH history (length>1)", async () => {
    mockPathname = "/artifact/projects/wegopro";
    mockHistoryLength = 3;
    Object.defineProperty(window, "history", {
      configurable: true,
      value: { length: 3 },
    });
    vi.resetModules();
    const { useCloseArtifact } = await import("@/features/artifacts/hooks/useCloseArtifact");
    const { result } = renderHook(() => useCloseArtifact());
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});
