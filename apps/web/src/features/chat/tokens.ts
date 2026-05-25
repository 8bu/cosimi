import type { MatchTier } from "@simlm/types";

// Friendly UI labels for the four matcher tiers. Server-side terms
// (exact/fts/trigram/session_teach) stay internal — the user sees these.
export function tierLabel(tier: MatchTier): string {
  switch (tier) {
    case "exact":
      return "exact match";
    case "fts":
      return "partial match";
    case "trigram":
      return "fuzzy match";
    case "session_teach":
      return "from your last teach";
  }
}

// Both the composer's purple-border indicator and the store's send() branch
// use this to decide if input looks like a /teach command. The server's
// PREFIX_RE in apps/api/src/services/teach-parser.ts is canonical — keep
// these in lockstep. The trailing \s* the server uses is for *consuming*
// the prefix, not detecting it; bare \b is correct here.
export const TEACH_PREFIX_RE = /^\/teach\b/i;
