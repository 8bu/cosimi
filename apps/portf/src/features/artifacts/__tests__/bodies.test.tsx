import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

function d(overrides: Partial<ArtifactDescriptor> = {}): ArtifactDescriptor {
  return {
    kind: "projects",
    slug: "x",
    title: "t",
    kicker: "k",
    period: "2026",
    stack: ["TypeScript", "React"],
    summary: "a one-line blurb",
    thumb: null,
    matchPatterns: ["xx"],
    locale: "en",
    order: 0,
    Component: () => <p data-testid="mdx-body">mdx body</p>,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe.each(["projects", "essays", "resume", "misc"] as const)(
  "body component for %s",
  (kind) => {
    const fileByKind: Record<typeof kind, string> = {
      projects: "ProjectBody",
      essays: "EssayBody",
      resume: "CvBody",
      misc: "GenericBody",
    };

    it(`renders mdx body with .is-${kind} modifier and stack footer`, async () => {
      const Mod = await import(`@/features/artifacts/components/bodies/${fileByKind[kind]}`);
      const Component = Mod[fileByKind[kind]];
      const { container } = render(<Component descriptor={d({ kind })} />);
      expect(screen.getByText("TypeScript · React")).toBeTruthy();
      expect(screen.getByTestId("mdx-body")).toBeTruthy();
      const body = container.querySelector(`.artifact-body.is-${kind}`);
      expect(body).toBeTruthy();
      const footer = container.querySelector(`.artifact-body.is-${kind} > .artifact-body-footer`);
      expect(footer).toBeTruthy();
    });

    it("does NOT render summary inside the body (panel.meta owns it)", async () => {
      const Mod = await import(`@/features/artifacts/components/bodies/${fileByKind[kind]}`);
      const Component = Mod[fileByKind[kind]];
      const { container } = render(<Component descriptor={d({ kind })} />);
      expect(container.textContent).not.toContain("a one-line blurb");
    });

    it("omits stack line when stack is empty", async () => {
      const Mod = await import(`@/features/artifacts/components/bodies/${fileByKind[kind]}`);
      const Component = Mod[fileByKind[kind]];
      const { container } = render(<Component descriptor={d({ kind, stack: [] })} />);
      expect(container.querySelector(".artifact-body-stack")).toBeNull();
    });
  },
);
