import type { MatchResult } from "@simlm/types";
import { sql } from "@simlm/db";

// Hits pairs_normalized_unaccented_idx (B-tree, partial on deleted_at IS NULL).
export async function exactTier(
  normalizedInput: string,
  topK: number,
): Promise<MatchResult | null> {
  // `id::int AS id` — BIGSERIAL round-trips as a string through postgres.js
  // by default; the cast lands a JS number to match MatchResult.pairId's
  // type and keeps wire shapes numeric (the chat-handler emits this id in
  // the SSE metadata event; feedback's valibot validator wants v.number()).
  const rows = await sql()<{ id: number; response: string; score: number }[]>`
    SELECT id::int AS id, response, score
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
    score: pick.score,
    lowConfidence: false,
  };
}
