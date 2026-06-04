import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "@cosimi/core";
import type { IngestDeps } from "@cosimi/sdk/offline";
import {
  addEdge,
  createChunk,
  createDocument,
  insertPair,
  mapChunkToPair,
  setPairStatus,
  setPairVector,
  softDeletePair,
  updatePairResponse,
} from "@cosimi/adapter-postgres";
import type { AnthropicLike } from "@cosimi/adapter-llm-anthropic";
import { createAnthropicLLM } from "@cosimi/adapter-llm-anthropic";
import { createOllamaEmbedder } from "@cosimi/adapter-embed-ollama";
import { createLocalStorage } from "@cosimi/adapter-storage";

/**
 * Assemble the offline IngestService dependencies from the @cosimi adapters.
 * Composes the already-exported adapter-postgres free functions (the exact set
 * proven by packages/sdk/src/offline/ingest-service.test.ts's makeDeps), plus:
 * two Anthropic LLMs (Sonnet generate, Haiku audit — one client, two models),
 * an ollama embedder (Node), and a local-FS storage repository. Node-only;
 * never imported by the Workers api.
 *
 * `apiKey` is the operator's Anthropic key, passed in by the route from the
 * `X-Anthropic-Key` request header (managed client-side in the admin UI). It is
 * NEVER read from env and NEVER logged — the server holds no LLM secret at rest.
 */
export function buildIngestDeps(apiKey: string): IngestDeps {
  if (!apiKey) {
    throw new Error("Anthropic API key is required for /ingest (send the X-Anthropic-Key header).");
  }
  const env = loadEnv();
  const client = new Anthropic({ apiKey }) as unknown as AnthropicLike;
  return {
    storage: createLocalStorage({ dir: env.STORAGE_DIR }),
    generateLLM: createAnthropicLLM({ client, model: env.INGEST_GENERATE_MODEL }),
    auditLLM: createAnthropicLLM({ client, model: env.INGEST_AUDIT_MODEL }),
    embedder: createOllamaEmbedder({
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_EMBED_MODEL,
      dimension: env.EMBEDDING_DIM,
    }),
    documents: { create: createDocument },
    chunks: { create: createChunk },
    graph: { addEdge: (from, to, type) => addEdge(from, to, type) },
    pairs: { insertPair, setPairVector },
    mapChunkToPair,
    setPairStatus,
    updatePairResponse,
    softDeletePair,
  };
}
