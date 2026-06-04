import * as v from "valibot";

const enumEnv = <T extends string>(values: readonly T[], def: T) =>
  v.optional(v.picklist(values), def);

const intEnv = (def: number) =>
  v.pipe(v.optional(v.string(), String(def)), v.decimal(), v.transform(Number), v.integer());

const intRangeEnv = (def: number, min: number) =>
  v.pipe(
    v.optional(v.string(), String(def)),
    v.decimal(),
    v.transform(Number),
    v.integer(),
    v.minValue(min),
  );

const floatRangeEnv = (def: number, min: number, max: number) =>
  v.pipe(
    v.optional(v.string(), String(def)),
    v.decimal(),
    v.transform(Number),
    v.minValue(min),
    v.maxValue(max),
  );

const strEnv = (def: string) => v.optional(v.string(), def);

// process.env values are always strings; accept the canonical "true"/"false"
// and transform to a real boolean. Refusing other casings ("True", "1", "yes")
// is deliberate — silent coercion of typos is how a "feature flag I thought
// was off" becomes a production incident.
const boolEnv = (def: boolean) =>
  v.pipe(
    v.optional(v.string(), String(def)),
    v.picklist(["true", "false"]),
    v.transform((s) => s === "true"),
  );

export const EnvSchema = v.object({
  NODE_ENV: enumEnv(["development", "test", "production"] as const, "development"),
  PORT: intRangeEnv(3000, 1),
  ADMIN_PORT: intRangeEnv(3001, 1),
  ADMIN_HOST: strEnv("127.0.0.1"),
  DATABASE_URL: v.pipe(v.string(), v.url()),
  LOG_LEVEL: enumEnv(["debug", "info", "warn", "error"] as const, "info"),

  GC_INTERVAL_MS: intRangeEnv(300_000, 1_000),
  SESSION_TTL_HOURS: intRangeEnv(24, 1),
  SESSION_TEACH_TTL_MINUTES: intRangeEnv(10, 1),

  // The embedding dimension the GraphRAG schema's `vector(N)` column was created
  // with. The SDK asserts the injected embedder's `dimension` equals this at
  // construction — a wrong-dimension embedder must fail loudly, never write
  // incompatible vectors.
  EMBEDDING_DIM: intRangeEnv(1024, 1),

  // ─── GraphRAG retrieval defaults (runtime) ────────────────────────────────
  // Max chunks returned by retrieve(). Seed count = nearest chunks used as graph
  // anchors. maxHops = undirected graph expansion from each seed. minSimilarity
  // is the cosine floor applied to SEEDS ONLY — graph neighbors are included
  // regardless (the GraphRAG value-add), then everything is ranked by similarity.
  RETRIEVE_TOP_K: intRangeEnv(8, 1),
  RETRIEVE_SEED_K: intRangeEnv(4, 1),
  RETRIEVE_MAX_HOPS: intRangeEnv(2, 0),
  // 0.45 floor (benchmarked on a real corpus): bge-m3 cosine for clearly-relevant
  // content runs ~0.45–0.7, while off-topic queries land ~0.32–0.43 — so 0.45 is
  // the separating line that rejects junk yet keeps real matches. 0.5 was too high
  // (lost real hits); 0.3 too low (off-topic leaked). Lower via the tuning panel
  // for more recall.
  RETRIEVE_MIN_SIMILARITY: floatRangeEnv(0.45, 0, 1),

  // ─── Runtime embedder selection ───────────────────────────────────────────
  // Which EmbeddingPort the runtime (playgrounds/api) builds. `ollama` is the
  // dev/test default (Node-capable, local daemon). `workers-ai` is the prod
  // path inside the api Worker (needs the AI binding; deployment operator-gated).
  // admin-api ingest ALWAYS uses ollama (Node-only — no Workers binding exists).
  // Both target bge-m3 / 1024-dim so dev and prod share one vector space.
  EMBEDDER: enumEnv(["ollama", "workers-ai"] as const, "ollama"),
  OLLAMA_BASE_URL: strEnv("http://localhost:11434"),
  OLLAMA_EMBED_MODEL: strEnv("bge-m3"),
  WORKERS_AI_EMBED_MODEL: strEnv("@cf/baai/bge-m3"),

  // ─── Offline ingest (admin-api, Node-only) ────────────────────────────────
  // Generate = Sonnet (quality), audit = Haiku (cheap/fast). STORAGE_DIR backs
  // the local FS StorageRepository. The Anthropic API KEY is deliberately NOT an
  // env var — it is operator-managed client-side in the admin UI (localStorage)
  // and sent per-request as the `X-Anthropic-Key` header, so the server holds no
  // LLM secret at rest. See playgrounds/admin-api/src/routes/ingest.ts.
  INGEST_GENERATE_MODEL: strEnv("claude-sonnet-4-6"),
  INGEST_AUDIT_MODEL: strEnv("claude-haiku-4-5-20251001"),
  STORAGE_DIR: strEnv("./.storage"),

  // When true, the /chat metadata SSE event carries tier/confidence/score —
  // useful in dev for debugging "why did the matcher pick this?". When false
  // (the production default), those three fields are nulled on the wire:
  // pairId and lowConfidence still ship because voting + the "low confidence"
  // / "no match" UX affordances depend on them, but the *how-it-matched*
  // details that could be reverse-engineered from many requests are hidden.
  // Defaults to false — explicit opt-in in dev .env, fail-closed in prod.
  EXPOSE_MATCH_INSIGHTS: boolEnv(false),

  SSE_DELAY_MODE: enumEnv(["char", "token"] as const, "token"),
  SSE_DELAY_BASE_MS: intEnv(30),
  SSE_DELAY_JITTER_MS: intEnv(20),

  TEACH_RATE_LIMIT_PER_HOUR: intRangeEnv(10, 1),
  TEACH_MAX_LENGTH: intRangeEnv(500, 1),
  TEACH_BLOCKLIST_REGEX: strEnv(""),

  FALLBACK_MESSAGE: strEnv("hmm idk, tell me more?"),
  PRUNE_SCORE_THRESHOLD: v.pipe(
    v.optional(v.string(), "-3"),
    v.decimal(),
    v.transform(Number),
    v.integer(),
  ),
});

export type Env = v.InferOutput<typeof EnvSchema>;

export function loadEnv(): Env {
  return v.parse(EnvSchema, process.env);
}
