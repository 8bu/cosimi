import type { MatchResult } from "@cosimi/core";
import { loadEnv } from "@cosimi/core";

import type { SqlAccessor, TierContext, TierHandler } from "./types";
import { runCascade, tier1Handlers } from "./registry";

export interface MatchOptions {
  /** Already-normalized input (NFC + lowercase + whitespace-collapsed). */
  normalizedInput: string;
  /** Session id for session-teach lookup. `null` skips that tier. */
  sessionId: string | null;
  /**
   * Ordered locale preference. The matcher tries each locale in turn,
   * running the full cascade (session_teach → exact → fts → trigram) for
   * each, and returns the first hit. 'und'-tagged rows match alongside the
   * requested locale inside each tier (see tier WHERE clauses).
   *
   * Missing / empty → defaults to ['und'] so legacy callers (and tests)
   * still hit the universal pool.
   */
  locales?: string[];
  /**
   * The tier cascade to run. Defaults to `tier1Handlers` (exact/fts/trigram +
   * session_teach). The SDK appends Tier 2/3 handlers here to extend matching.
   */
  tiers?: TierHandler[];
}

/**
 * Run the match cascade. `sql` is the injected postgres client accessor — the
 * matcher stays adapter-agnostic; the caller (SDK / app) supplies the client.
 */
export async function match(sql: SqlAccessor, opts: MatchOptions): Promise<MatchResult | null> {
  const env = loadEnv();
  const locales = opts.locales && opts.locales.length > 0 ? opts.locales : ["und"];
  const handlers = opts.tiers ?? tier1Handlers;

  // Per-locale cascade: full sweep for each locale before falling through to
  // the next. A Vi session-teach SHOULD beat an English exact match; the
  // cross-tier ordering "tier first, then locale" would invert that priority
  // and surprise users mid-conversation.
  for (const locale of locales) {
    const ctx: TierContext = {
      sql,
      normalizedInput: opts.normalizedInput,
      locale,
      sessionId: opts.sessionId,
      topK: env.MATCH_TOP_K,
      ftsMin: env.MATCH_FTS_MIN,
      trgmMin: env.MATCH_TRGM_MIN,
    };
    const hit = await runCascade(handlers, ctx);
    if (hit) return hit;
  }

  return null;
}

export { runCascade, tier1Handlers } from "./registry";
export { sessionTeachHandler, exactHandler, ftsHandler, trigramHandler } from "./registry";
export type { SqlAccessor, TierContext, TierHandler } from "./types";
export { sessionTeachTier } from "./tiers/session-teach";
export { exactTier } from "./tiers/exact";
export { ftsTier } from "./tiers/fts";
export { trigramTier } from "./tiers/trigram";
