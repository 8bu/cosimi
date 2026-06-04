import { describe, expect, it } from "vitest";
import { chunkMarkdown, hasHeadings } from "./markdown";

describe("hasHeadings", () => {
  it("detects ## / ### headings", () => {
    expect(hasHeadings("# Title\n## Section\ntext")).toBe(true);
  });
  it("ignores ## inside fenced code", () => {
    expect(hasHeadings("```\n## not a heading\n```")).toBe(false);
  });
  it("false when no h2/h3", () => {
    expect(hasHeadings("# only h1\nplain text")).toBe(false);
  });
});

describe("chunkMarkdown", () => {
  it("makes one chunk per ## section with section_title set", () => {
    const md = "## Alpha\nAlpha body.\n## Beta\nBeta body.";
    const nodes = chunkMarkdown(md, { splitThreshold: 600 });
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.sectionTitle).toBe("Alpha");
    expect(nodes[0]!.content).toContain("Alpha body.");
    expect(nodes[0]!.children).toBeUndefined();
  });

  it("keeps leading pre-heading content as a null-title chunk", () => {
    const md = "Intro paragraph.\n## Alpha\nbody";
    const nodes = chunkMarkdown(md, { splitThreshold: 600 });
    expect(nodes[0]!.sectionTitle).toBeNull();
    expect(nodes[0]!.content).toContain("Intro paragraph.");
  });

  it("does NOT borrow text from the next section (no overlap)", () => {
    const md = "## Alpha\nAlpha body.\n## Beta\nBeta first. Beta second.";
    const nodes = chunkMarkdown(md, { splitThreshold: 600 });
    // Each chunk is grounded in exactly its own section — cross-chunk continuity
    // is the chunk_relations graph, not duplicated text.
    expect(nodes[0]!.content).toBe("Alpha\nAlpha body.");
    expect(nodes[0]!.content).not.toContain("Beta");
    expect(nodes[1]!.content).toBe("Beta\nBeta first. Beta second.");
  });

  it("emits no chunk for a container heading with no body", () => {
    // `## Experience` with an empty body (next heading follows immediately) is a
    // pure container — it must NOT become a chunk, and must NOT absorb the first
    // line of the next section.
    const md = "## Experience\n### Job A\nFull-time Remote\nDid the work here.";
    const nodes = chunkMarkdown(md, { splitThreshold: 600 });
    expect(nodes.map((n) => n.sectionTitle)).toEqual(["Job A"]);
    expect(nodes[0]!.content).toBe("Job A\nFull-time Remote\nDid the work here.");
    expect(nodes.some((n) => n.content.includes("Experience"))).toBe(false);
  });

  it("does not treat ## inside a code fence as a heading", () => {
    const md = "## Real\nbefore\n```\n## fake heading\n```\nafter";
    const nodes = chunkMarkdown(md, { splitThreshold: 600 });
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.content).toContain("## fake heading");
  });

  it("splits a >threshold section into PARENT_OF children", () => {
    const md = "## Big\nS1 sentence. S2 sentence. S3 sentence. S4 sentence.";
    const nodes = chunkMarkdown(md, { splitThreshold: 5 });
    expect(nodes).toHaveLength(1);
    const parent = nodes[0]!;
    expect(parent.sectionTitle).toBe("Big");
    expect(parent.children!.length).toBeGreaterThanOrEqual(2);
    expect(parent.children!.every((c) => c.sectionTitle === "Big")).toBe(true);
    // Parent is structural: heading + lead sentence only.
    expect(parent.content.startsWith("Big\nS1 sentence.")).toBe(true);
    // Every body sentence lands in some child (none dropped).
    const childText = parent.children!.map((c) => c.content).join(" ");
    for (const s of ["S1 sentence.", "S2 sentence.", "S3 sentence.", "S4 sentence."]) {
      expect(childText).toContain(s);
    }
  });
});
