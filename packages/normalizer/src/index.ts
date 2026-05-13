/**
 * Normalize an input string for matching. Diacritics are preserved here —
 * Postgres strips them server-side via f_unaccent() (see Phase 2).
 *
 * Steps:
 *   1. NFC unicode normalization (collapse decomposed forms)
 *   2. lowercase
 *   3. collapse internal whitespace
 *   4. trim
 */
export function normalize(input: string): string {
  return input.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}
