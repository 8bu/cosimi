import type { MatchResult } from "@simlm/types";
import { sql } from "@simlm/db";

// session_teaches has no GENERATED unaccented column, so f_unaccent runs on
// both sides at query time. Acceptable: 10-min TTL keeps the table small.
export async function sessionTeachTier(
  sessionId: string,
  normalizedInput: string,
): Promise<MatchResult | null> {
  const rows = await sql()<{ response: string }[]>`
    SELECT response
    FROM session_teaches
    WHERE session_id = ${sessionId}
      AND f_unaccent(normalized_input) = f_unaccent(${normalizedInput})
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows.length) return null;
  return {
    response: rows[0]!.response,
    tier: "session_teach",
    confidence: 1.0,
    pairId: null,
    lowConfidence: false,
  };
}
