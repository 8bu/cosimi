import { describe, expect, it } from "vitest";
import { chunk } from "./index";
import { createScriptedEmbedder } from "../../../test/fake-embedder";

const noEmbed = createScriptedEmbedder(new Map());

describe("chunk dispatch", () => {
  it("uses Strategy A when ## headings are present", async () => {
    const nodes = await chunk(
      "## Alpha\nbody alpha\n## Beta\nbody beta",
      "text/markdown",
      noEmbed,
      {
        splitThreshold: 600,
        chunkSplitThreshold: 0.55,
        minSentences: 3,
      },
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.sectionTitle).toBe("Alpha");
  });

  it("falls to Strategy B for markdown WITHOUT headings", async () => {
    const A = "One sentence.",
      B = "Two sentence.";
    const embedder = createScriptedEmbedder(
      new Map([
        [A, [1, 0]],
        [B, [1, 0]],
      ]),
      2,
    );
    const nodes = await chunk(`${A} ${B}`, "text/markdown", embedder, {
      splitThreshold: 600,
      chunkSplitThreshold: 0.55,
      minSentences: 1,
    });
    expect(nodes.every((n) => n.sectionTitle === null)).toBe(true);
  });

  it("strips HTML before Strategy B", async () => {
    const embedder = createScriptedEmbedder(new Map([["Hi there.", [1, 0]]]), 2);
    const nodes = await chunk("<p>Hi there.</p>", "text/html", embedder, {
      splitThreshold: 600,
      chunkSplitThreshold: 0.55,
      minSentences: 1,
    });
    expect(nodes[0]!.content).toBe("Hi there.");
  });
});
