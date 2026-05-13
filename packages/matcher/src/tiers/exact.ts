import type { MatchResult } from "@simlm/types";
import { sql } from "@simlm/db";

// Hits pairs_normalized_unaccented_idx (B-tree, partial on deleted_at IS NULL).
export async function exactTier(
  normalizedInput: string,
  topK: number,
): Promise<MatchResult | null> {
  const rows = await sql()<{ id: number; response: string }[]>`
    SELECT id, response
    FROM pairs
    WHERE normalized_unaccented = f_unaccent(${normalizedInput})
      AND deleted_at IS NULL
    ORDER BY score DESC, id DESC
    LIMIT ${topK}
  `;
  if (!rows.length) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)]!;
  return {
    response: pick.response,
    tier: "exact",
    confidence: 1.0,
    pairId: pick.id,
    lowConfidence: false,
  };
}
