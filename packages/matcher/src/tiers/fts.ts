import type { MatchResult } from "@simlm/types";
import { sql } from "@simlm/db";

// Hits pairs_fts_idx (GIN on to_tsvector('simple', normalized_unaccented)).
// ts_rank can theoretically exceed 1.0; clamp so the UI gets a 0..1 scale.
// Locale filter + ordering mirrors exactTier (see exact.ts).
export async function ftsTier(
  normalizedInput: string,
  locale: string,
  minRank: number,
  topK: number,
): Promise<MatchResult | null> {
  // `id::int AS id` — BIGSERIAL ships as string through postgres.js;
  // cast so MatchResult.pairId is a number (see exact.ts for full rationale).
  const rows = await sql()<
    { id: number; response: string; rank: number; score: number; locale: string }[]
  >`
    SELECT id, response, rank, score, locale
    FROM (
      SELECT
        id::int AS id,
        response,
        score,
        locale,
        ts_rank(
          to_tsvector('simple', normalized_unaccented),
          plainto_tsquery('simple', f_unaccent(${normalizedInput}))
        ) AS rank
      FROM pairs
      WHERE deleted_at IS NULL
        AND (locale = ${locale} OR locale = 'und')
        AND to_tsvector('simple', normalized_unaccented)
            @@ plainto_tsquery('simple', f_unaccent(${normalizedInput}))
    ) ranked
    WHERE rank >= ${minRank}
    ORDER BY (locale = ${locale}) DESC, rank DESC, score DESC, id DESC
    LIMIT ${topK}
  `;
  if (!rows.length) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)]!;
  return {
    response: pick.response,
    tier: "fts",
    confidence: Math.min(pick.rank, 1.0),
    pairId: pick.id,
    score: pick.score,
    lowConfidence: false,
    locale: pick.locale,
  };
}
