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

  MATCH_FTS_MIN: floatRangeEnv(0.1, 0, 1),
  MATCH_TRGM_MIN: floatRangeEnv(0.4, 0, 1),
  MATCH_TOP_K: intRangeEnv(5, 1),

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
