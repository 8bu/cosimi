import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useRouterState: (arg?: { select?: (s: { location: { pathname: string } }) => unknown }) =>
    arg?.select ? arg.select({ location: { pathname: "/" } }) : "/",
  Link: ({ children, ...rest }: { children: React.ReactNode; [k: string]: unknown }) => (
    <a {...rest}>{children}</a>
  ),
}));

// ArtifactsNavItem reads the catalog through this helper; mock it so
// the sidebar test doesn't need MDX modules wired up.
vi.mock("@/features/artifacts-index/data", () => ({
  totalGalleryItems: () => 7,
}));

vi.mock("@/store/threads", () => {
  const state = {
    threads: [
      { id: "t1", ts: 1000, title: "older" },
      { id: "t2", ts: 2000, title: "newer" },
    ],
    rename: vi.fn(),
    remove: vi.fn(),
  };
  const useStore = (sel: (s: typeof state) => unknown) => sel(state);
  useStore.getState = () => state;
  return { useThreadsStore: useStore };
});

vi.mock("@/store/ui", () => {
  const state = { isSidebarOpen: false, setSidebarOpen: vi.fn(), toggleSidebar: vi.fn() };
  const useStore = (sel: (s: typeof state) => unknown) => sel(state);
  useStore.getState = () => state;
  useStore.setState = (next: Partial<typeof state>) => Object.assign(state, next);
  return { useUiStore: useStore };
});

describe("Sidebar", () => {
  beforeEach(async () => {
    const { useUiStore } = await import("@/store/ui");
    useUiStore.setState({ isSidebarOpen: false });
  });

  it("renders threads newest-first", async () => {
    const { Sidebar } = await import("@/features/sidebar/components/Sidebar");
    const { container } = render(<Sidebar />);
    // Only real thread rows have a `.v1-dot` child - the footer email row
    // and the Earlier-empty placeholder both reuse `.v1-thread` for badge
    // layout but don't include the dot. Filter on it to scope to actual
    // ThreadRow entries.
    const rows = Array.from(container.querySelectorAll(".v1-thread")).filter(
      (r) => r.querySelector(":scope > .v1-dot") !== null,
    );
    const titles = rows
      .map(
        (r) =>
          Array.from(r.children).find(
            (c) =>
              c.tagName === "SPAN" &&
              !c.className.includes("v1-dot") &&
              !c.className.includes("v1-thread-meta"),
          )?.textContent,
      )
      .filter(Boolean);
    expect(titles).toEqual(["newer", "older"]);
  });

  it("includes a NEW CHAT button", async () => {
    const { Sidebar } = await import("@/features/sidebar/components/Sidebar");
    const { container } = render(<Sidebar />);
    expect(container.querySelector(".v1-new-btn")).not.toBeNull();
  });

  it("adds is-open when ui store is open + renders backdrop", async () => {
    const { useUiStore } = await import("@/store/ui");
    useUiStore.setState({ isSidebarOpen: true });
    const { Sidebar } = await import("@/features/sidebar/components/Sidebar");
    const { container } = render(<Sidebar />);
    expect(container.querySelector(".v1-sidebar.is-open")).not.toBeNull();
    expect(container.querySelector(".sidebar-backdrop")).not.toBeNull();
  });

  it("backdrop click closes the drawer", async () => {
    const { useUiStore } = await import("@/store/ui");
    useUiStore.setState({ isSidebarOpen: true });
    const { Sidebar } = await import("@/features/sidebar/components/Sidebar");
    const { container } = render(<Sidebar />);
    const backdrop = container.querySelector(".sidebar-backdrop")!;
    fireEvent.click(backdrop);
    expect(useUiStore.getState().setSidebarOpen).toHaveBeenCalledWith(false);
  });
});
