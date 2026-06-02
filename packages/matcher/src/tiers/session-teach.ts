import type { MatchResult } from "@cosimi/core";
import { sql } from "@cosimi/adapter-postgres";

// session_teaches has no GENERATED unaccented column, so f_unaccent runs on
// both sides at query time. Acceptable: 10-min TTL keeps the table small.
//
// Locale rule mirrors the pair tiers: rows tagged with the requested locale
// OR 'und' (universal) match. The matched row's locale ships in the result
// so the UI can annotate "from <locale>" when the fallback fires.
export async function sessionTeachTier(
  sessionId: string,
  normalizedInput: string,
  locale: string,
): Promise<MatchResult | null> {
  const rows = await sql()<{ response: string; locale: string }[]>`
    SELECT response, locale
    FROM session_teaches
    WHERE session_id = ${sessionId}
      AND f_unaccent(normalized_input) = f_unaccent(${normalizedInput})
      AND expires_at > NOW()
      AND (locale = ${locale} OR locale = 'und')
    ORDER BY (locale = ${locale}) DESC, created_at DESC
    LIMIT 1
  `;
  if (!rows.length) return null;
  return {
    response: rows[0]!.response,
    tier: "session_teach",
    confidence: 1.0,
    pairId: null,
    // No underlying pair — score is meaningless for this tier. UI omits
    // the "· score N" trailer when score is null.
    score: null,
    lowConfidence: false,
    locale: rows[0]!.locale,
    // session_teaches has no topic column; topic is pair-level metadata.
    topic: null,
  };
}
