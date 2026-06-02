import type { MatchResult } from "@cosimi/core";

import type { CosimiConfig } from "./config";
import { MatchService, type MatchInput } from "./services/match";

/**
 * The Cosimi runtime client. Construct one per consumer (Node app) or per
 * request (Workers, so the injected request-scoped sql is correct). The match
 * surface is stable; teach/admin/ingest are added as they are extracted.
 */
export interface CosimiClient {
  /**
   * Match a raw user query against the pair store. Returns the matched reply
   * (with tier/confidence/locale metadata) or `null` on no match — the caller
   * supplies the fallback.
   */
  match(query: string, input?: MatchInput): Promise<MatchResult | null>;
}

/** Build a {@link CosimiClient} from injected config (sql accessor + optional tiers). */
export function createCosimi(config: CosimiConfig): CosimiClient {
  const matchService = new MatchService(config.sql, config.tiers);
  return {
    match: (query, input) => matchService.match(query, input),
  };
}
