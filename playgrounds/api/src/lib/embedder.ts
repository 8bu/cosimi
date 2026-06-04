import { AsyncLocalStorage } from "node:async_hooks";
import type { EmbeddingPort } from "@cosimi/core";
import { loadEnv } from "@cosimi/core";
import { createOllamaEmbedder } from "@cosimi/adapter-embed-ollama";
import { createWorkersAiEmbedder, type AiBinding } from "@cosimi/adapter-embed-workers-ai";

// The Workers AI binding is request-scoped (it lives on the Worker's `env`,
// only available inside fetch). We carry it to the route via AsyncLocalStorage
// — the same discipline as adapter-postgres's request-scoped sql client. In
// Node (EMBEDDER=ollama) the store is never set and never read.
const aiStore = new AsyncLocalStorage<AiBinding>();

/** Run `fn` with the Workers AI binding in scope (Worker entry only). */
export function runWithAi<T>(ai: AiBinding, fn: () => T): T {
  return aiStore.run(ai, fn);
}

/**
 * Build the runtime EmbeddingPort from env. `ollama` (default) needs no
 * binding — Node dev/test + the SDK dimension guard. `workers-ai` reads the
 * request-scoped binding set by `runWithAi`; absent it (mis-config), throw
 * loudly rather than silently mis-embed.
 */
export function resolveEmbedder(): EmbeddingPort {
  const env = loadEnv();
  if (env.EMBEDDER === "workers-ai") {
    const ai = aiStore.getStore();
    if (!ai) {
      throw new Error(
        "EMBEDDER=workers-ai but no AI binding in scope; the Worker entry must wrap the request in runWithAi(env.AI, …).",
      );
    }
    return createWorkersAiEmbedder({
      ai,
      model: env.WORKERS_AI_EMBED_MODEL,
      dimension: env.EMBEDDING_DIM,
    });
  }
  return createOllamaEmbedder({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_EMBED_MODEL,
    dimension: env.EMBEDDING_DIM,
  });
}
