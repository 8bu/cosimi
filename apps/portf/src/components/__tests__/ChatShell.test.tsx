import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let mockPath = "/";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (arg?: { select?: (s: { location: { pathname: string } }) => string }) =>
    arg?.select ? arg.select({ location: { pathname: mockPath } }) : mockPath,
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

vi.mock("@/features/sidebar/components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
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
