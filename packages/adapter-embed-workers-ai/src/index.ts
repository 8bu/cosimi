import type { EmbeddingPort } from "@cosimi/core";

/**
 * Structural subset of the Cloudflare Workers AI binding we use. Declared here
 * (not via `@cloudflare/workers-types`) so this package neither imports nor
 * bundles the Workers types — the binding is injected by the Worker entry, and
 * tests stub it. `run` returns `{ data }` for embedding models like bge-m3.
 */
export interface AiBinding {
  run(model: string, inputs: { text: string[] }): Promise<{ data: number[][] }>;
}

export interface WorkersAiEmbedderOptions {
  /** The Worker's `env.AI` binding (or a stub). */
  ai: AiBinding;
  /** Embedding model. Default `@cf/baai/bge-m3` (1024-dim, multilingual). */
  model?: string;
  /** Vector dimension. MUST match the model + the migration's `vector(N)`. Default 1024. */
  dimension?: number;
}

/**
 * EmbeddingPort backed by Cloudflare Workers AI. Same model + dimension as the
 * dev ollama embedder (bge-m3 / 1024) so dev and prod share one vector space.
 * Workers-only runtime (the binding exists solely inside a Worker isolate).
 */
export function createWorkersAiEmbedder(opts: WorkersAiEmbedderOptions): EmbeddingPort {
  const model = opts.model ?? "@cf/baai/bge-m3";
  const dimension = opts.dimension ?? 1024;
  return {
    dimension,
    async embed(texts) {
      if (texts.length === 0) return [];
      const res = await opts.ai.run(model, { text: texts });
      return res.data;
    },
  };
}
