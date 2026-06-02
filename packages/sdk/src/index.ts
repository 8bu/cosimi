export { createCosimi } from "./client";
export type { CosimiClient } from "./client";
export type { CosimiConfig } from "./config";
export type { MatchInput } from "./services/match";

// Re-export the cascade primitives so consumers can build custom tier
// registries (Tier 2/3) and pass them via `CosimiConfig.tiers`.
export type { SqlAccessor, TierContext, TierHandler } from "@cosimi/matcher";
export { tier1Handlers, runCascade } from "@cosimi/matcher";
export type { MatchResult } from "@cosimi/core";
