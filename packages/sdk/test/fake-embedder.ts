import type { EmbeddingPort } from "@cosimi/core";

export { createFakeEmbedder } from "@cosimi/adapter-embed-fake";

/**
 * A scripted embedder: maps exact texts to caller-supplied vectors so cosine
 * boundaries in Strategy-B chunking tests are deterministic. Unknown texts get
 * a zero vector (cosine 0 with everything → forces a boundary).
 */
export function createScriptedEmbedder(map: Map<string, number[]>, dimension = 3): EmbeddingPort {
  return {
    dimension,
    embed: (texts) =>
      Promise.resolve(texts.map((t) => map.get(t) ?? Array.from({ length: dimension }, () => 0))),
  };
}
