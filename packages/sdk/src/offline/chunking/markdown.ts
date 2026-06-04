import { estimateTokens } from "../tokens";
import { splitSentences } from "./text";
import type { ChunkNode } from "../types";

const HEADING_RE = /^(#{2,3})\s+(.+?)\s*$/;
const FENCE_RE = /^(```|~~~)/;

interface RawSection {
  title: string | null;
  body: string;
}

/** True if the markdown has at least one ## / ### heading outside a code fence. */
export function hasHeadings(md: string): boolean {
  let fenced = false;
  for (const line of md.split("\n")) {
    if (FENCE_RE.test(line.trim())) fenced = !fenced;
    else if (!fenced && HEADING_RE.test(line)) return true;
  }
  return false;
}

function sectionize(md: string): RawSection[] {
  const sections: RawSection[] = [];
  let fenced = false;
  let current: RawSection = { title: null, body: "" };
  let started = false;

  for (const line of md.split("\n")) {
    if (FENCE_RE.test(line.trim())) fenced = !fenced;
    const m = fenced ? null : HEADING_RE.exec(line);
    if (m) {
      if (started || current.body.trim()) sections.push(current);
      current = { title: m[2]!, body: "" };
      started = true;
    } else {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  // The push guard above never admits a null-title + empty-body section, so no
  // post-filter is needed.
  if (started || current.body.trim()) sections.push(current);
  return sections;
}

/**
 * Strategy A (spec §8): one chunk per ## / ### section. Sections over
 * `splitThreshold` tokens become a structural parent (heading + lead sentence)
 * with sentence-grouped children linked PARENT_OF.
 *
 * No text overlap: cross-chunk continuity is the `chunk_relations` graph
 * (REFERENCES / PARENT_OF edges), so each chunk stays grounded in exactly its
 * own section — borrowing the next section's first sentence used to inject
 * foreign facts (e.g. one job's location into another's chunk) that the auditor
 * would then "ground" into wrong pairs. Pure container headings (a `##` with no
 * body before the next heading) emit no chunk — their child `###` sections stand
 * alone with their own titles.
 */
export function chunkMarkdown(md: string, opts: { splitThreshold: number }): ChunkNode[] {
  const sections = sectionize(md);
  const nodes: ChunkNode[] = [];

  for (const s of sections) {
    const baseBody = s.body.trim();
    if (!baseBody) continue; // container heading / empty section — no standalone chunk
    const full = (s.title ? `${s.title}\n` : "") + baseBody;

    if (estimateTokens(full) <= opts.splitThreshold) {
      nodes.push({ content: full, sectionTitle: s.title });
      continue;
    }

    // Over threshold → split body sentences into ≤threshold groups.
    const sentences = splitSentences(baseBody);
    const lead = sentences[0] ?? "";
    const parentContent = (s.title ? `${s.title}\n` : "") + lead;
    const children: ChunkNode[] = [];
    let buf: string[] = [];
    const flush = () => {
      if (buf.length) {
        children.push({ content: buf.join(" "), sectionTitle: s.title });
        buf = [];
      }
    };
    for (const sent of sentences) {
      const candidate = [...buf, sent].join(" ");
      if (buf.length && estimateTokens(candidate) > opts.splitThreshold) flush();
      buf.push(sent);
    }
    flush();
    nodes.push({ content: parentContent, sectionTitle: s.title, children });
  }

  return nodes;
}
