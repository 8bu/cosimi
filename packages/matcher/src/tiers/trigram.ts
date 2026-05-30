import type { MatchResult } from "@cosimi/types";
import { sql } from "@cosimi/db";

// Hits pairs_trgm_idx (GIST + gist_trgm_ops). The `%` operator short-circuits
// via the index; the explicit similarity(...) >= minSim filter applies the
// threshold from env on top so we don't rely on Postgres' set_limit() GUC.
// Locale filter + ordering mirrors exactTier (see exact.ts).
export async function trigramTier(
  normalizedInput: string,
  locale: string,
  minSim: number,
  topK: number,
): Promise<MatchResult | null> {
  // `id::int AS id` — BIGSERIAL ships as string through postgres.js;
  // cast so MatchResult.pairId is a number (see exact.ts for full rationale).
  const rows = await sql()<
    {
      id: number;
      response: string;
      sim: number;
      score: number;
      locale: string;
      topic: string | null;
    }[]
  >`
    SELECT
      id::int AS id,
      response,
      score,
      locale,
      topic,
      similarity(normalized_unaccented, f_unaccent(${normalizedInput})) AS sim
    FROM pairs
    WHERE deleted_at IS NULL
      AND (locale = ${locale} OR locale = 'und')
      AND normalized_unaccented % f_unaccent(${normalizedInput})
      AND similarity(normalized_unaccented, f_unaccent(${normalizedInput})) >= ${minSim}
    ORDER BY (locale = ${locale}) DESC, sim DESC, score DESC, id DESC
    LIMIT ${topK}
  `;
  if (!rows.length) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)]!;
  return {
    response: pick.response,
    tier: "trigram",
    confidence: pick.sim,
    pairId: pick.id,
    score: pick.score,
    lowConfidence: true,
    locale: pick.locale,
    topic: pick.topic,
  };
}
