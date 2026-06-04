import type { EmbeddingPort, RetrievalResult } from "@cosimi/core";
import { loadEnv } from "@cosimi/core";
import { retrieve, type SqlAccessor } from "@cosimi/retriever";

export interface RetrieveInput {
  /** Max chunks returned (default env RETRIEVE_TOP_K). */
  topK?: number;
  /** Nearest chunks used as graph seeds (default env RETRIEVE_SEED_K). */
  seedK?: number;
  /** Graph expansion hops (default env RETRIEVE_MAX_HOPS). */
  maxHops?: number;
  /** Seed similarity floor (default env RETRIEVE_MIN_SIMILARITY). */
  minSimilarity?: number;
  /** Optional pair-locale filter. */
  locales?: string[];
}

export interface RetrievalServiceDeps {
  sql: SqlAccessor;
  embedder: EmbeddingPort;
}

/**
 * Runtime GraphRAG retrieval. Embeds the RAW query ONCE (the offline pipeline
 * embedded pairs/chunks from raw text too), resolves env defaults for the
 * numeric knobs, and calls the pure retriever retrieve(). The embedder is
 * mandatory — `createCosimi` rejects a config without one, so this service is
 * never constructed without a query-vector encoder.
 */
export class RetrievalService {
  readonly #sql: SqlAccessor;
  readonly #embedder: EmbeddingPort;

  constructor(deps: RetrievalServiceDeps) {
    this.#sql = deps.sql;
    this.#embedder = deps.embedder;
  }

  async retrieve(query: string, input: RetrieveInput = {}): Promise<RetrievalResult> {
    const vec = (await this.#embedder.embed([query]))[0];
    if (!vec) throw new Error("EmbeddingPort.embed returned an empty batch");

    const env = loadEnv();
    return retrieve(this.#sql, {
      queryEmbedding: vec,
      topK: input.topK ?? env.RETRIEVE_TOP_K,
      seedK: input.seedK ?? env.RETRIEVE_SEED_K,
      maxHops: input.maxHops ?? env.RETRIEVE_MAX_HOPS,
      minSimilarity: input.minSimilarity ?? env.RETRIEVE_MIN_SIMILARITY,
      locales: input.locales,
    });
  }
}
