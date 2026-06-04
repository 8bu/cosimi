import type { EmbeddingPort } from "@cosimi/core";

export interface OllamaEmbedderOptions {
  /** Base URL of the ollama daemon, e.g. `http://localhost:11434`. */
  baseUrl: string;
  /** Embedding model. Default `bge-m3` (1024-dim, multilingual). */
  model?: string;
  /** Vector dimension. MUST match the model + the migration's `vector(N)`. Default 1024. */
  dimension?: number;
  /** Injectable fetch (defaults to global). Lets tests stub the daemon. */
  fetch?: typeof globalThis.fetch;
}

interface EmbedResponse {
  embeddings: number[][];
}

/**
 * EmbeddingPort backed by a local ollama daemon's `/api/embed` (batch) endpoint.
 * Same model + dimension as the prod Workers AI embedder (bge-m3 / 1024) so dev
 * and prod share one vector space. Node-capable (dev runtime + offline pipeline).
 */
export function createOllamaEmbedder(opts: OllamaEmbedderOptions): EmbeddingPort {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const model = opts.model ?? "bge-m3";
  const dimension = opts.dimension ?? 1024;
  const doFetch = opts.fetch ?? globalThis.fetch;

  return {
    dimension,
    async embed(texts) {
      if (texts.length === 0) return [];
      const res = await doFetch(`${base}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input: texts }),
      });
      if (!res.ok) {
        throw new Error(`ollama embed failed: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as EmbedResponse;
      return data.embeddings;
    },
  };
}
