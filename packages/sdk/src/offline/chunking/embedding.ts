import type { EmbeddingPort } from "@cosimi/core";
import { estimateTokens } from "../tokens";
import { splitSentences } from "./text";
import { cosineSimilarity } from "../vec";
import type { ChunkNode } from "../types";

export interface EmbeddingChunkOptions {
  chunkSplitThreshold: number; // cosine below this = boundary
  minSentences: number; // groups smaller than this merge into a neighbor
  splitThreshold: number; // token ceiling; a merged group above it re-splits
}

/**
 * Strategy B (spec §8): semantic chunking for headingless text. Split sentences,
 * embed them, cut where adjacent cosine drops below the threshold, merge runs
 * shorter than `minSentences`, and re-split any group over the token ceiling at
 * its weakest interior seam. Flat output (no PARENT_OF), null section titles.
 */
export async function chunkByEmbedding(
  text: string,
  embedder: EmbeddingPort,
  opts: EmbeddingChunkOptions,
): Promise<ChunkNode[]> {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) {
    return sentences.length === 1 ? [{ content: sentences[0]!, sectionTitle: null }] : [];
  }

  const embs = await embedder.embed(sentences);

  // 1. Cut at low-similarity boundaries → groups of sentence indices.
  const groups: number[][] = [[0]];
  for (let i = 1; i < sentences.length; i++) {
    const sim = cosineSimilarity(embs[i - 1]!, embs[i]!);
    if (sim < opts.chunkSplitThreshold) groups.push([i]);
    else groups[groups.length - 1]!.push(i);
  }

  // 2. Merge runs shorter than minSentences into the previous (or next) group.
  const merged: number[][] = [];
  for (const g of groups) {
    if (g.length < opts.minSentences && merged.length > 0) {
      merged[merged.length - 1]!.push(...g);
    } else {
      merged.push(g);
    }
  }
  // A leading short group has no previous → fold into the following group.
  // (After pass 2, merged[1] is always ≥ minSentences — a short groups[1] would
  // already have folded into merged[0] — so a single fold here suffices.)
  if (merged.length > 1 && merged[0]!.length < opts.minSentences) {
    const head = merged.shift()!;
    merged[0]!.unshift(...head);
  }

  // 3. Re-split any over-ceiling group at its weakest interior seam. ONE level
  // only: a group >2× the ceiling may still exceed it after the split. Spec-
  // acceptable for v1 (spec §8) — corpora rarely produce such blobs.
  const final: number[][] = [];
  for (const g of merged) {
    const txt = g.map((i) => sentences[i]!).join(" ");
    if (g.length > 1 && estimateTokens(txt) > opts.splitThreshold) {
      let weakest = 1;
      let weakestSim = Infinity;
      for (let k = 1; k < g.length; k++) {
        const sim = cosineSimilarity(embs[g[k - 1]!]!, embs[g[k]!]!);
        if (sim < weakestSim) {
          weakestSim = sim;
          weakest = k;
        }
      }
      final.push(g.slice(0, weakest), g.slice(weakest));
    } else {
      final.push(g);
    }
  }

  return final.map((g) => ({
    content: g.map((i) => sentences[i]!).join(" "),
    sectionTitle: null,
  }));
}
