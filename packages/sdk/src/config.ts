import type { EmbeddingPort } from "@cosimi/core";
import type { SqlAccessor } from "@cosimi/retriever";

/**
 * Everything the SDK needs to run, supplied by the consumer. The SDK holds no
 * module-level state and no concrete driver dependency: the consumer builds the
 * postgres client (pooled on Node, or request-scoped via AsyncLocalStorage on
 * Cloudflare Workers) and injects its accessor here, keeping the SDK
 * Workers-safe and adapter-agnostic.
 */
export interface CosimiConfig {
  /**
   * The postgres client accessor (e.g. `sql` from `@cosimi/adapter-postgres`).
   * It's the accessor, not the client, so Workers' request-scoped resolution
   * happens at call time.
   */
  sql: SqlAccessor;
  /**
   * Text → vector encoder. MANDATORY (D4): runtime retrieval is meaningless
   * without a query vector, so `createCosimi` throws when it's absent. The SDK
   * asserts `embedder.dimension === EMBEDDING_DIM` at construction — a
   * wrong-dimension embedder must fail loudly, never write incompatible vectors.
   */
  embedder: EmbeddingPort;
}
