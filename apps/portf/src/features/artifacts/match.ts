import type { MatchTier } from "@simlm/types";

import { getCatalog } from "@/features/artifacts/catalog";
import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface MatchArgs {
  input: string;
  tier: MatchTier | null;
  primaryLocale: string;
  /** Tests pass synthetic descriptors; production omits and reads getCatalog(). */
  catalog?: ArtifactDescriptor[];
}

/** Reverse-substring minimum: avoids 1-3 char inputs matching every pattern. */
const REVERSE_MATCH_MIN_LEN = 4;

/**
 * Pure matcher. Three gates:
 *   1. tier: any non-null tier passes (exact / fts / trigram). The
 *      operator's seed corpus identified the topic via Postgres FTS or
 *      trigram; matchPatterns is the precise filter. null (no_match) skips.
 *   2. locale: descriptors filtered to (primary first, then 'en' fallback)
 *   3. matchPatterns: case-insensitive substring against NFC-normalized
 *      input. BIDIRECTIONAL: `input.includes(pattern)` for "user typed extra
 *      context" + `pattern.includes(input)` for "user typed a prefix/typo",
 *      gated to input length >= 4 so short inputs don't fan out.
 *
 * First descriptor whose any pattern hits the input wins.
 */
export function matchArtifact(args: MatchArgs): ArtifactDescriptor | null {
  if (args.tier === null) return null;

  const candidates = args.catalog ?? getCatalog();
  const primary = candidates.filter((d) => d.locale === args.primaryLocale);
  const fallback = args.primaryLocale === "en" ? [] : candidates.filter((d) => d.locale === "en");

  const normalized = args.input.normalize("NFC").trim().toLowerCase();
  if (!normalized) return null;
  const allowReverse = normalized.length >= REVERSE_MATCH_MIN_LEN;

  for (const d of [...primary, ...fallback]) {
    for (const pattern of d.matchPatterns) {
      const p = pattern.toLowerCase();
      if (normalized.includes(p)) return d;
      if (allowReverse && p.includes(normalized)) return d;
    }
  }

  return null;
}
