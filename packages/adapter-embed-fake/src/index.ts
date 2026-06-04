import type { EmbeddingPort } from "@cosimi/core";

// Deterministic, dep-free EmbeddingPort for tests + ollama-less dev. Each text
// seeds an LCG from a cheap string hash, producing a reproducible vector in
// [-1, 1]. Same text → same vector; different text → different direction. NOT a
// semantic encoder — it only gives stable, distinguishable vectors so vector
// plumbing (storage, NN ordering, tier wiring) can be exercised without a model.

function hash(s: string): number {
  let h = 2166136261; // FNV-1a basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function vectorFor(text: string, dimension: number): number[] {
  let x = (hash(text) + 1) >>> 0;
  return Array.from({ length: dimension }, () => {
    x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff;
    return (x / 0x7fffffff) * 2 - 1; // [-1, 1]
  });
}

/** A deterministic in-process EmbeddingPort. `dimension` defaults to 1024 (bge-m3). */
export function createFakeEmbedder(dimension = 1024): EmbeddingPort {
  return {
    dimension,
    embed: (texts) => Promise.resolve(texts.map((t) => vectorFor(t, dimension))),
  };
}
