import type { MatchResult } from "@cosimi/core";

import type { TierContext, TierHandler } from "./types";
import { sessionTeachTier } from "./tiers/session-teach";
import { exactTier } from "./tiers/exact";
import { ftsTier } from "./tiers/fts";
import { trigramTier } from "./tiers/trigram";

/**
 * Run handlers in order for one context, short-circuiting on the first non-null
 * result. This is the cascade's plugin seam: extending the matcher (Tier 2
 * vector, Tier 3 graph) means appending handlers, never editing this function.
 */
export async function runCascade(
  handlers: TierHandler[],
  ctx: TierContext,
): Promise<MatchResult | null> {
  for (const handler of handlers) {
    const hit = await handler.run(ctx);
    if (hit !== null) return hit;
  }
  return null;
}

// ─── Tier 1 handlers ────────────────────────────────────────────────────────
// Thin wrappers over the existing tier query functions. Behavior is unchanged;
// they only adapt each tier's positional signature to the `TierHandler` shape.

export const sessionTeachHandler: TierHandler = {
  name: "session_teach",
  run: (ctx) =>
    // Skip the session-teach tier entirely when there's no session id.
    ctx.sessionId === null
      ? Promise.resolve(null)
      : sessionTeachTier(ctx.sql, ctx.sessionId, ctx.normalizedInput, ctx.locale),
};

export const exactHandler: TierHandler = {
  name: "exact",
  run: (ctx) => exactTier(ctx.sql, ctx.normalizedInput, ctx.locale, ctx.topK),
};

export const ftsHandler: TierHandler = {
  name: "fts",
  run: (ctx) => ftsTier(ctx.sql, ctx.normalizedInput, ctx.locale, ctx.ftsMin, ctx.topK),
};

export const trigramHandler: TierHandler = {
  name: "trigram",
  run: (ctx) => trigramTier(ctx.sql, ctx.normalizedInput, ctx.locale, ctx.trgmMin, ctx.topK),
};

/** Default cascade: session_teach → exact → fts → trigram. */
export const tier1Handlers: TierHandler[] = [
  sessionTeachHandler,
  exactHandler,
  ftsHandler,
  trigramHandler,
];
