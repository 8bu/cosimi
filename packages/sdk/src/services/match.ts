import type { MatchResult } from "@cosimi/core";
import { match, type SqlAccessor, type TierHandler } from "@cosimi/matcher";
import { normalize } from "@cosimi/normalizer";

export interface MatchInput {
  /** Session id for the session-teach tier. Omitted/null skips that tier. */
  sessionId?: string | null;
  /**
   * Ordered locale preference. The cascade runs per-locale; 'und' rows match
   * alongside the requested locale. Defaults to ['und'].
   */
  locales?: string[];
}

/**
 * Runtime match service. Normalizes the raw query (NFC + lowercase + whitespace,
 * diacritics preserved) and runs the tier cascade. No LLM, ever — the only reply
 * source is the pair store.
 */
export class MatchService {
  readonly #sql: SqlAccessor;
  readonly #tiers: TierHandler[] | undefined;

  constructor(sql: SqlAccessor, tiers?: TierHandler[]) {
    this.#sql = sql;
    this.#tiers = tiers;
  }

  match(query: string, input: MatchInput = {}): Promise<MatchResult | null> {
    return match(this.#sql, {
      normalizedInput: normalize(query),
      sessionId: input.sessionId ?? null,
      locales: input.locales,
      tiers: this.#tiers,
    });
  }
}
