import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

let mockPath = "/chat/abc";
let mockSearch: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (arg?: {
    select?: (s: { location: { pathname: string; search: Record<string, unknown> } }) => unknown;
  }) => {
    const state = { location: { pathname: mockPath, search: mockSearch } };
    return arg?.select ? arg.select(state) : state;
  },
  useNavigate: () => vi.fn(),
  useRouter: () => ({ navigate: vi.fn(), history: { back: vi.fn() } }),
  useParams: () => ({}),
}));

vi.mock("@/features/sidebar/components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

const getDescriptor = vi.fn();
vi.mock("@/features/artifacts/catalog", () => ({
  getDescriptor: (slug: string) => getDescriptor(slug),
}));

afterEach(() => {
  cleanup();
  getDescriptor.mockReset();
});

function descriptor(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "wegopro",
    title: "WegoPro",
    kicker: "k",
    period: "2022–2026",
    stack: ["TS"],
    summary: "s",
    thumb: null,
    matchPatterns: ["xx"],
    locale: "en",
    order: 0,
    Component: () => <span data-testid="mdx" />,
    ...overrides,
  };
}

describe("<ChatShell> with ?artifact=<slug>", () => {
  it("data-artifact-open='false' when no slug", async () => {
    mockPath = "/chat/abc";
    mockSearch = {};
    vi.resetModules();
    const { ChatShell } = await import("@/components/ChatShell");
    const { container } = render(
      <ChatShell>
        <span>chat</span>
      </ChatShell>,
    );
    const shell = container.querySelector(".chat-shell") as HTMLElement;
    expect(shell.getAttribute("data-artifact-open")).toBe("false");
    expect(container.querySelector(".artifact-pane")).toBeNull();
  });

  it("data-artifact-open='true' and ArtifactPane rendered when slug resolves", async () => {
    mockPath = "/chat/abc";
    mockSearch = { artifact: "wegopro" };
    getDescriptor.mockReturnValueOnce(descriptor());
    vi.resetModules();
    const { ChatShell } = await import("@/components/ChatShell");
    const { container } = render(
      <ChatShell>
        <span>chat</span>
      </ChatShell>,
    );
    const shell = container.querySelector(".chat-shell") as HTMLElement;
    expect(shell.getAttribute("data-artifact-open")).toBe("true");
    expect(container.querySelector(".artifact-pane")).toBeTruthy();
  });

  it("data-artifact-open='false' when slug set but catalog miss", async () => {
    mockPath = "/chat/abc";
    mockSearch = { artifact: "nonexistent" };
    getDescriptor.mockReturnValueOnce(null);
    vi.resetModules();
    const { ChatShell } = await import("@/components/ChatShell");
    const { container } = render(
      <ChatShell>
        <span>chat</span>
      </ChatShell>,
    );
    const shell = container.querySelector(".chat-shell") as HTMLElement;
    expect(shell.getAttribute("data-artifact-open")).toBe("false");
    expect(container.querySelector(".artifact-pane")).toBeNull();
  });

  it("does not render ArtifactPane outside /chat/*", async () => {
    mockPath = "/";
    mockSearch = { artifact: "wegopro" };
    getDescriptor.mockReturnValueOnce(descriptor());
    vi.resetModules();
    const { ChatShell } = await import("@/components/ChatShell");
    const { container } = render(
      <ChatShell>
        <span>home</span>
      </ChatShell>,
    );
    expect(container.querySelector(".chat-shell")).toBeNull();
    expect(container.querySelector(".artifact-pane")).toBeNull();
  });
});
