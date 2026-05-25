import { renderTemplate } from "@simlm/template";
import { AlertTriangle } from "lucide-react";
import type { MatchTier } from "@simlm/types";
import type { BotMsg } from "@/features/chat/types";
import { useTranslate, type TranslationKey } from "@/lib/i18n";

const TIER_KEY: Record<MatchTier, TranslationKey> = {
  exact: "badge.exact",
  fts: "badge.fts",
  trigram: "badge.trigram",
  session_teach: "badge.session_teach",
};

// Quiet inline annotation, no pill chrome — editorial aesthetic. The
// score trailer is omitted for the session_teach tier (meta.score is null
// there — no underlying pair) and shown for exact/fts/trigram tiers
// where it reflects pairs.score (vote tally, can be negative). The locale
// trailer ("matched in <locale>") is gated by EXPOSE_MATCH_INSIGHTS like
// tier itself — server nulls meta.locale when the flag is off.
export function MatchBadge({ meta, noMatch }: { meta: BotMsg["meta"]; noMatch?: boolean }) {
  const t = useTranslate();
  if (noMatch) {
    return (
      <span className="inline-flex items-center gap-1 text-warning-foreground">
        <AlertTriangle className="size-3" /> {t("badge.noMatch")}
      </span>
    );
  }
  if (!meta) return null;
  if (meta.lowConfidence) {
    return (
      <span className="inline-flex items-center gap-1 text-warning-foreground">
        <AlertTriangle className="size-3" /> {t("badge.lowConfidence")}
      </span>
    );
  }
  // tier is null when the server runs with EXPOSE_MATCH_INSIGHTS=false —
  // there's nothing meaningful to show, so render nothing. (Vote buttons
  // still appear separately because they're gated on pairId, not tier.)
  if (!meta.tier) return null;
  return (
    <span className="text-muted-foreground">
      {t(TIER_KEY[meta.tier])}
      {meta.score !== null && ` · ${t("badge.score")} ${meta.score}`}
      {/* Only annotate when the matched row carries a *real* locale tag.
          'und' (BCP-47 "undetermined") is the universal fallback — every
          pre-Phase-11.1 row is 'und', so showing it here would label
          ~every match with schema jargon. The annotation is useful only
          when it signals cross-language fallback (Vi user, En match). */}
      {meta.locale &&
        meta.locale !== "und" &&
        ` · ${renderTemplate(t("badge.fromLocale"), { locale: meta.locale })}`}
    </span>
  );
}
