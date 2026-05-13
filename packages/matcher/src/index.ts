import type { MatchResult } from "@simlm/types";
import { loadEnv } from "@simlm/config";
import { sessionTeachTier } from "./tiers/session-teach";
import { exactTier } from "./tiers/exact";
import { ftsTier } from "./tiers/fts";
import { trigramTier } from "./tiers/trigram";

export interface MatchOptions {
  /** Already-normalized input (NFC + lowercase + whitespace-collapsed). */
  normalizedInput: string;
  /** Session id for session-teach lookup. `null` skips that tier. */
  sessionId: string | null;
}

export async function match(opts: MatchOptions): Promise<MatchResult | null> {
  const env = loadEnv();

  if (opts.sessionId) {
    const r = await sessionTeachTier(opts.sessionId, opts.normalizedInput);
    if (r) return r;
  }

  const ex = await exactTier(opts.normalizedInput, env.MATCH_TOP_K);
  if (ex) return ex;

  const fts = await ftsTier(opts.normalizedInput, env.MATCH_FTS_MIN, env.MATCH_TOP_K);
  if (fts) return fts;

  const tri = await trigramTier(opts.normalizedInput, env.MATCH_TRGM_MIN, env.MATCH_TOP_K);
  if (tri) return tri;

  return null;
}

export { sessionTeachTier } from "./tiers/session-teach";
export { exactTier } from "./tiers/exact";
export { ftsTier } from "./tiers/fts";
export { trigramTier } from "./tiers/trigram";
