import type { RetrievalResult } from "@cosimi/core";
import { loadEnv } from "@cosimi/core";

import type { CosimiConfig } from "./config";
import { HealthService, type HealthReport } from "./services/health";
import { RetrievalService, type RetrieveInput } from "./services/retrieval";

/**
 * The Cosimi runtime client. Construct one per consumer (Node app) or per
 * request (Workers, so the injected request-scoped sql is correct). Runtime is
 * LLM-free: `retrieve()` returns ranked chunks with their linked pairs; the
 * consumer owns any downstream RAG/LLM step.
 */
export interface CosimiClient {
  /**
   * Probe the database for reachability and GraphRAG schema readiness. OPT-IN:
   * call once after startup (NOT at construction — the SDK does no I/O at build
   * time to stay Workers-safe). Returns a report; never throws on a not-ready DB.
   */
  healthcheck(): Promise<HealthReport>;
  /**
   * GraphRAG retrieval: embed the query, seed from nearest chunks, expand the
   * graph, return ranked chunks with their linked pairs.
   */
  retrieve(query: string, input?: RetrieveInput): Promise<RetrievalResult>;
}

/** Build a {@link CosimiClient} from injected config (sql accessor + embedder). */
export function createCosimi(config: CosimiConfig): CosimiClient {
  if (!config.embedder) {
    throw new Error("createCosimi requires an embedder; runtime retrieval needs a query vector.");
  }
  // Dimension guard: a wrong-dimension embedder writes vectors the schema's
  // `vector(N)` column rejects (or silently mis-ranks). Fail loudly at construction time.
  // NOTE (Workers): this calls loadEnv(); on Cloudflare Workers createCosimi
  // MUST run at request time (inside app.fetch), never module scope — deploy
  // validation runs with no DATABASE_URL and loadEnv() would throw.
  const dim = loadEnv().EMBEDDING_DIM;
  if (config.embedder.dimension !== dim) {
    throw new Error(
      `Embedder dimension ${config.embedder.dimension} != EMBEDDING_DIM ${dim}. ` +
        `The injected embedder must match the schema's vector(N).`,
    );
  }

  const healthService = new HealthService({
    sql: config.sql,
    embedderDimension: config.embedder.dimension,
  });
  const retrievalService = new RetrievalService({
    sql: config.sql,
    embedder: config.embedder,
  });
  return {
    healthcheck: () => healthService.check(),
    retrieve: (query, input) => retrievalService.retrieve(query, input),
  };
}
