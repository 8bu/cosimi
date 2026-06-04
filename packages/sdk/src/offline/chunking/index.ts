import type { EmbeddingPort } from "@cosimi/core";
import { chunkMarkdown, hasHeadings } from "./markdown";
import { chunkByEmbedding } from "./embedding";
import { htmlToText } from "./text";
import type { ChunkNode } from "../types";

export interface ChunkOptions {
  splitThreshold: number;
  chunkSplitThreshold: number;
  minSentences: number;
}

/**
 * Dispatch by heading presence (spec §5 step 2), NOT mime: markdown with ##/###
 * → Strategy A; everything else (plain text, HTML, headingless markdown) →
 * Strategy B. HTML is flattened to text first (structure parsing deferred, E1).
 */
export async function chunk(
  raw: string,
  mimeType: string,
  embedder: EmbeddingPort,
  opts: ChunkOptions,
): Promise<ChunkNode[]> {
  const text = mimeType === "text/html" ? htmlToText(raw) : raw;
  if (mimeType !== "text/html" && hasHeadings(text)) {
    return chunkMarkdown(text, { splitThreshold: opts.splitThreshold });
  }
  return chunkByEmbedding(text, embedder, {
    chunkSplitThreshold: opts.chunkSplitThreshold,
    minSentences: opts.minSentences,
    splitThreshold: opts.splitThreshold,
  });
}
