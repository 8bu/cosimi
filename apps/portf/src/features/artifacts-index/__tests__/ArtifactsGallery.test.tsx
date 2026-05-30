import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

/**
 * The gallery reads the catalog through the data helpers. Mock those at
 * the boundary so we don't have to wire MDX fixtures - the helpers
 * already exercise the descriptor → gallery-item mapping via the
 * tests they belong to, and this suite is about render + filter
 * switching, not data shape.
 */
const fakeProjects = [
  {
    slug: "p-one",
    name: "WegoPro",
    yr: "2022–2026",
    live: true,
    tags: "TS · Vue",
    desc: "Project one desc",
    coral: true,
    href: "/artifact/projects/p-one",
  },
  {
    slug: "p-two",
    name: "Multiplier",
    yr: "2019–2022",
    live: false,
    tags: "Vue · Web3",
    desc: "Project two desc",
    coral: false,
    href: "/artifact/projects/p-two",
  },
];

const fakeEssays = [
  {
    slug: "e-one",
    n: "01",
    title: "Essay one",
    meta: "2026 · essay",
    dek: "Essay one dek",
    href: "/artifact/essays/e-one",
  },
  {
    slug: "e-two",
    n: "02",
    title: "Essay two",
    meta: "2026 · essay",
    dek: "Essay two dek",
    href: "/artifact/essays/e-two",
  },
];

const fakeResume = {
  slug: "longnguyen-2026",
  title: "longnguyen-2026.pdf",
  period: "12 days ago",
  summary: "Long NGUYỄN",
  url: "/longnguyen-2026.pdf",
  href: "/artifact/resume/longnguyen-2026",
};

vi.mock("@/features/artifacts-index/data", () => ({
  projectsForGallery: () => fakeProjects,
  essaysForGallery: () => fakeEssays,
  resumeForGallery: () => fakeResume,
  totalGalleryItems: () => fakeProjects.length + fakeEssays.length + 1,
}));

// Render <Link> as a plain <a> in jsdom. The router root isn't mounted
// in these tests; we only need the href so navigation intent is
// assertable.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

// Touched only so the import type alias resolves; the gallery does not
// use ArtifactDescriptor at runtime.
void (null as unknown as ArtifactDescriptor);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ArtifactsGallery", () => {
  it("renders header kicker with the total item count", async () => {
    const { ArtifactsGallery } =
      await import("@/features/artifacts-index/components/ArtifactsGallery");
    render(<ArtifactsGallery />);
    expect(screen.getByText(/ARTIFACTS · 5 ITEMS/)).toBeInTheDocument();
    expect(screen.getByText(/Everything,/)).toBeInTheDocument();
  });

  it("shows the two-column All view by default", async () => {
    const { ArtifactsGallery } =
      await import("@/features/artifacts-index/components/ArtifactsGallery");
    render(<ArtifactsGallery />);
    // Project rows + essay rows + CV slab visible
    expect(screen.getByText("WegoPro")).toBeInTheDocument();
    expect(screen.getByText("Essay one")).toBeInTheDocument();
    expect(screen.getByText(/Curriculum Vitae/)).toBeInTheDocument();
    // No expanded project card thumb-label in All view
    expect(screen.queryByText(/live preview/)).not.toBeInTheDocument();
  });

  it("switches to the Projects card grid when the pill is clicked", async () => {
    const { ArtifactsGallery } =
      await import("@/features/artifacts-index/components/ArtifactsGallery");
    render(<ArtifactsGallery />);
    fireEvent.click(screen.getByRole("tab", { name: "Projects" }));
    // Cards expose the "case study" / "live preview" thumb labels
    expect(screen.getByText("live preview")).toBeInTheDocument();
    expect(screen.getByText("case study")).toBeInTheDocument();
    // CV slab gone; essays gone
    expect(screen.queryByText(/Curriculum Vitae/)).not.toBeInTheDocument();
    expect(screen.queryByText("Essay one")).not.toBeInTheDocument();
  });

  it("switches to the Writing list when the pill is clicked", async () => {
    const { ArtifactsGallery } =
      await import("@/features/artifacts-index/components/ArtifactsGallery");
    render(<ArtifactsGallery />);
    fireEvent.click(screen.getByRole("tab", { name: "Writing" }));
    expect(screen.getByText("Essay one dek")).toBeInTheDocument();
    expect(screen.getByText("Essay two dek")).toBeInTheDocument();
    expect(screen.queryByText("WegoPro")).not.toBeInTheDocument();
  });

  it("switches to the CV detail when the pill is clicked", async () => {
    const { ArtifactsGallery } =
      await import("@/features/artifacts-index/components/ArtifactsGallery");
    render(<ArtifactsGallery />);
    fireEvent.click(screen.getByRole("tab", { name: "CV" }));
    expect(screen.getByText(/Long NGUYỄN/)).toBeInTheDocument();
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText("Stack")).toBeInTheDocument();
    expect(screen.getByText(/AI workflow/)).toBeInTheDocument();
  });

  it("project rows link to the artifact route", async () => {
    const { ArtifactsGallery } =
      await import("@/features/artifacts-index/components/ArtifactsGallery");
    render(<ArtifactsGallery />);
    const link = screen.getByLabelText("Open project WegoPro");
    expect(link).toHaveAttribute("href", "/artifact/projects/p-one");
  });
});
