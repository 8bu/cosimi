import type postgres from "postgres";
import type { MatchResult } from "@cosimi/core";

/**
 * The postgres client accessor. Injected by the caller (the SDK threads the
 * consumer's adapter client here) so `@cosimi/matcher` has no dependency on any
 * concrete adapter package. It's the *accessor* (a function), not the client
 * instance, so Cloudflare Workers' request-scoped ALS resolution happens at
 * call time — exactly as the adapter's own `sql()` does.
 */
export type SqlAccessor = () => ReturnType<typeof postgres>;

/**
 * Everything a tier handler needs to run, for a single locale. The cascade runs
 * one context per locale (a Vi session-teach must beat an English exact match),
 * so `locale` is singular here; `match()` loops locales.
 */
export interface TierContext {
  sql: SqlAccessor;
  /** Already-normalized input (NFC + lowercase + whitespace-collapsed). */
  normalizedInput: string;
  locale: string;
  /** Session id for session-teach lookup. `null` skips that tier. */
  sessionId: string | null;
  topK: number;
  ftsMin: number;
  trgmMin: number;
}

/**
 * A single tier in the match cascade. `run` returns a `MatchResult` on a hit or
 * `null` to fall through to the next handler. New tiers (Tier 2 vector, Tier 3
 * graph) register by appending handlers — no change to `runCascade`/`match`.
 */
export interface TierHandler {
  name: string;
  run(ctx: TierContext): Promise<MatchResult | null>;
}
