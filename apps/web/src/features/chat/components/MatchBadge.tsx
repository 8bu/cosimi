import { AlertTriangle } from "lucide-react";
import type { BotMsg } from "@/features/chat/types";
import { tierLabel } from "@/features/chat/tokens";

// Quiet inline annotation, no pill chrome — editorial aesthetic. The
// score trailer is omitted for the session_teach tier (meta.score is null
// there — no underlying pair) and shown for exact/fts/trigram tiers
// where it reflects pairs.score (vote tally, can be negative).
export function MatchBadge({ meta, noMatch }: { meta: BotMsg["meta"]; noMatch?: boolean }) {
  if (noMatch) {
    return (
      <span className="inline-flex items-center gap-1 text-warning-foreground">
        <AlertTriangle className="size-3" /> no match
      </span>
    );
  }
  if (!meta) return null;
  if (meta.lowConfidence) {
    return (
      <span className="inline-flex items-center gap-1 text-warning-foreground">
        <AlertTriangle className="size-3" /> low confidence
      </span>
    );
  }
  // tier is null when the server runs with EXPOSE_MATCH_INSIGHTS=false —
  // there's nothing meaningful to show, so render nothing. (Vote buttons
  // still appear separately because they're gated on pairId, not tier.)
  if (!meta.tier) return null;
  return (
    <span className="text-muted-foreground">
      {tierLabel(meta.tier)}
      {meta.score !== null && ` · score ${meta.score}`}
    </span>
  );
}
