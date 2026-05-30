import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let mockPath = "/";
let mockSearch: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (arg?: {
    select?: (s: { location: { pathname: string; search: Record<string, unknown> } }) => unknown;
  }) => {
    const state = { location: { pathname: mockPath, search: mockSearch } };
    return arg?.select ? arg.select(state) : state;
  },
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

vi.mock("@/features/sidebar/components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("@/features/artifacts/catalog", () => ({
  getDescriptor: () => null,
}));

vi.mock("@/features/artifacts/components/ArtifactPane", () => ({
  ArtifactPane: () => <div data-testid="artifact-pane" />,
}));

describe("ChatShell", () => {
  it("renders children without sidebar on /", async () => {
    mockPath = "/";
    vi.resetModules();
    const { ChatShell } = await import("@/components/ChatShell");
    const { queryByTestId, getByText } = render(
      <ChatShell>
        <span>hello</span>
      </ChatShell>,
    );
    expect(queryByTestId("sidebar")).toBeNull();
    expect(getByText("hello")).toBeInTheDocument();
  });

  it("renders sidebar + children on /chat/<id>", async () => {
    mockPath = "/chat/abc";
    vi.resetModules();
    const { ChatShell } = await import("@/components/ChatShell");
    const { getByTestId, getByText } = render(
      <ChatShell>
        <span>chat content</span>
      </ChatShell>,
    );
    expect(getByTestId("sidebar")).toBeInTheDocument();
    expect(getByText("chat content")).toBeInTheDocument();
  });
});
