/**
 * Normalize an input string for matching. Diacritics are preserved here —
 * Postgres strips them server-side via f_unaccent() (see Phase 2).
 *
 * Steps:
 *   1. NFC unicode normalization (collapse decomposed forms)
 *   2. lowercase
 *   3. collapse internal whitespace
 *   4. trim
 *   5. destylize: collapse runs of single letters/digits separated by
 *      "-" or single space (e.g. "b-a-s-e-d" → "based", "F B I" → "fbi").
 *      Leaves multi-char tokens like "x-ray" alone.
 */
export function normalize(input: string): string {
  const base = input.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  return destylize(base);
}

const STYLIZED_RUN = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}][-\s]){1,}[\p{L}\p{N}](?![\p{L}\p{N}])/gu;

function destylize(s: string): string {
  return s.replace(STYLIZED_RUN, (m) => m.replace(/[-\s]/g, ""));
}
