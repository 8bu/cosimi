import type { SqlAccessor, TierHandler } from "@cosimi/matcher";

/**
 * Everything the SDK needs to run, supplied by the consumer. The SDK holds no
 * module-level state and no concrete driver dependency: the consumer builds the
 * postgres client (with their own runtime strategy — pooled on Node, or
 * request-scoped via AsyncLocalStorage on Cloudflare Workers) and injects its
 * accessor here. That keeps `@cosimi/sdk` Workers-safe and adapter-agnostic.
 */
export interface CosimiConfig {
  /**
   * The postgres client accessor (e.g. `sql` from `@cosimi/adapter-postgres`).
   * It's the accessor, not the client, so Workers' request-scoped resolution
   * happens at call time.
   */
  sql: SqlAccessor;
  /**
   * Override the match cascade. Defaults to Tier 1 (session_teach → exact →
   * fts → trigram). Append Tier 2/3 handlers here to extend matching.
   */
  tiers?: TierHandler[];
}
