import type { MatchResult } from "@simlm/types";
import { sql } from "@simlm/db";

// Hits pairs_trgm_idx (GIST + gist_trgm_ops). The `%` operator short-circuits
// via the index; the explicit similarity(...) >= minSim filter applies the
// threshold from env on top so we don't rely on Postgres' set_limit() GUC.
export async function trigramTier(
  normalizedInput: string,
  minSim: number,
  topK: number,
): Promise<MatchResult | null> {
  const rows = await sql()<{ id: number; response: string; sim: number }[]>`
    SELECT
      id,
      response,
      similarity(normalized_unaccented, f_unaccent(${normalizedInput})) AS sim
    FROM pairs
    WHERE deleted_at IS NULL
      AND normalized_unaccented % f_unaccent(${normalizedInput})
      AND similarity(normalized_unaccented, f_unaccent(${normalizedInput})) >= ${minSim}
    ORDER BY sim DESC, score DESC, id DESC
    LIMIT ${topK}
  `;
  if (!rows.length) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)]!;
  return {
    response: pick.response,
    tier: "trigram",
    confidence: pick.sim,
    pairId: pick.id,
    lowConfidence: true,
  };
}
