import type { MatchResult } from "@simlm/types";
import { sql } from "@simlm/db";

// Hits pairs_fts_idx (GIN on to_tsvector('simple', normalized_unaccented)).
// ts_rank can theoretically exceed 1.0; clamp so the UI gets a 0..1 scale.
export async function ftsTier(
  normalizedInput: string,
  minRank: number,
  topK: number,
): Promise<MatchResult | null> {
  const rows = await sql()<{ id: number; response: string; rank: number }[]>`
    SELECT id, response, rank
    FROM (
      SELECT
        id,
        response,
        score,
        ts_rank(
          to_tsvector('simple', normalized_unaccented),
          plainto_tsquery('simple', f_unaccent(${normalizedInput}))
        ) AS rank
      FROM pairs
      WHERE deleted_at IS NULL
        AND to_tsvector('simple', normalized_unaccented)
            @@ plainto_tsquery('simple', f_unaccent(${normalizedInput}))
    ) ranked
    WHERE rank >= ${minRank}
    ORDER BY rank DESC, score DESC, id DESC
    LIMIT ${topK}
  `;
  if (!rows.length) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)]!;
  return {
    response: pick.response,
    tier: "fts",
    confidence: Math.min(pick.rank, 1.0),
    pairId: pick.id,
    lowConfidence: false,
  };
}
