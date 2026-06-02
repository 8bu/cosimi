import type { MatchResult } from "@cosimi/core";
import { sql } from "@cosimi/adapter-postgres";

// Hits pairs_normalized_unaccented_idx (B-tree, partial on deleted_at IS NULL).
// The added `(locale = $2 OR locale = 'und')` filter picks up pairs_locale_idx
// (partial on deleted_at IS NULL, see migration 010). ORDER BY (locale = $2)
// DESC ensures a locale-tagged match beats a universal one when both exist.
export async function exactTier(
  normalizedInput: string,
  locale: string,
  topK: number,
): Promise<MatchResult | null> {
  // `id::int AS id` — BIGSERIAL round-trips as a string through postgres.js
  // by default; the cast lands a JS number to match MatchResult.pairId's
  // type and keeps wire shapes numeric (the chat-handler emits this id in
  // the SSE metadata event; feedback's valibot validator wants v.number()).
  const rows = await sql()<
    { id: number; response: string; score: number; locale: string; topic: string | null }[]
  >`
    SELECT id::int AS id, response, score, locale, topic
    FROM pairs
    WHERE normalized_unaccented = f_unaccent(${normalizedInput})
      AND deleted_at IS NULL
      AND (locale = ${locale} OR locale = 'und')
    ORDER BY (locale = ${locale}) DESC, score DESC, id DESC
    LIMIT ${topK}
  `;
  if (!rows.length) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)]!;
  return {
    response: pick.response,
    tier: "exact",
    confidence: 1.0,
    pairId: pick.id,
    score: pick.score,
    lowConfidence: false,
    locale: pick.locale,
    topic: pick.topic,
  };
}
