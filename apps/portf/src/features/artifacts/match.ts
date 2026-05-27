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

/**
 * Pure matcher. Three gates:
 *   1. tier: must be 'exact' or 'fts' (trigram / session_teach / null skip)
 *   2. locale: descriptors filtered to (primary first, then 'en' fallback)
 *   3. matchPatterns: case-insensitive substring against NFC-normalized input
 *
 * First descriptor whose any pattern hits the input wins.
 */
export function matchArtifact(args: MatchArgs): ArtifactDescriptor | null {
  if (args.tier !== "exact" && args.tier !== "fts") return null;

  const candidates = args.catalog ?? getCatalog();
  const primary = candidates.filter((d) => d.locale === args.primaryLocale);
  const fallback = args.primaryLocale === "en" ? [] : candidates.filter((d) => d.locale === "en");

  const normalized = args.input.normalize("NFC").trim().toLowerCase();
  if (!normalized) return null;

  for (const d of [...primary, ...fallback]) {
    for (const pattern of d.matchPatterns) {
      if (normalized.includes(pattern.toLowerCase())) return d;
    }
  }

  return null;
}
