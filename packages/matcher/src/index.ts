import type { MatchResult } from "@cosimi/core";
import { loadEnv } from "@cosimi/core";
import { sessionTeachTier } from "./tiers/session-teach";
import { exactTier } from "./tiers/exact";
import { ftsTier } from "./tiers/fts";
import { trigramTier } from "./tiers/trigram";

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
}

export async function match(opts: MatchOptions): Promise<MatchResult | null> {
  const env = loadEnv();
  const locales = opts.locales && opts.locales.length > 0 ? opts.locales : ["und"];

  // Per-locale cascade: full 4-tier sweep for each locale before falling
  // through to the next. Rationale: a Vi session-teach SHOULD beat an
  // English exact match. The cross-tier ordering "tier first, then locale"
  // would invert that priority and surprise users mid-conversation.
  // Phase 11.2 may collapse into a single query with `WHERE locale = ANY($)`
  // + `ORDER BY array_position($, locale)` — premature now.
  for (const locale of locales) {
    if (opts.sessionId) {
      const r = await sessionTeachTier(opts.sessionId, opts.normalizedInput, locale);
      if (r) return r;
    }

    const ex = await exactTier(opts.normalizedInput, locale, env.MATCH_TOP_K);
    if (ex) return ex;

    const fts = await ftsTier(opts.normalizedInput, locale, env.MATCH_FTS_MIN, env.MATCH_TOP_K);
    if (fts) return fts;

    const tri = await trigramTier(
      opts.normalizedInput,
      locale,
      env.MATCH_TRGM_MIN,
      env.MATCH_TOP_K,
    );
    if (tri) return tri;
  }

  return null;
}

export { sessionTeachTier } from "./tiers/session-teach";
export { exactTier } from "./tiers/exact";
export { ftsTier } from "./tiers/fts";
export { trigramTier } from "./tiers/trigram";
