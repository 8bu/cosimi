import type { MatchTier } from "@cosimi/core";

import { getCatalog } from "@/features/artifacts/catalog";
import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface MatchArgs {
  input: string;
  tier: MatchTier | null;
  primaryLocale: string;
  /** Operator-assigned topic slug forwarded from the server metadata event. */
  topic?: string | null;
  /** Tests pass synthetic descriptors; production omits and reads getCatalog(). */
  catalog?: ArtifactDescriptor[];
}

/** Reverse-substring minimum: avoids 1-3 char inputs matching every pattern. */
const REVERSE_MATCH_MIN_LEN = 4;

/**
 * Pure matcher. Resolution order:
 *   1. Topic-first: if `topic` starts with "portfolio/artifact/", extract
 *      the slug after the prefix and look it up in the catalog directly.
 *      Catalog lookup is locale-agnostic (slug is unique). If found, return
 *      immediately — bypasses matchPatterns entirely.
 *   2. matchPatterns fallback (three gates):
 *      a. tier: any non-null tier passes (exact / fts / trigram). null
 *         (no_match) skips the entire function.
 *      b. locale: descriptors filtered to (primary first, then 'en' fallback)
 *      c. matchPatterns: case-insensitive substring against NFC-normalized
 *         input. BIDIRECTIONAL: `input.includes(pattern)` for "user typed
 *         extra context" + `pattern.includes(input)` for "user typed a
 *         prefix/typo", gated to input length >= 4 so short inputs don't
 *         fan out.
 *
 * First descriptor whose any pattern hits the input wins in the fallback path.
 */
export function matchArtifact(args: MatchArgs): ArtifactDescriptor | null {
  const candidates = args.catalog ?? getCatalog();

  // Topic-first path: unambiguous operator-controlled discriminator.
  const ARTIFACT_PREFIX = "portfolio/artifact/";
  if (args.topic && args.topic.startsWith(ARTIFACT_PREFIX)) {
    const slug = args.topic.slice(ARTIFACT_PREFIX.length);
    const found = candidates.find((d) => d.slug === slug);
    return found ?? null;
  }

  // matchPatterns fallback path: requires a non-null tier.
  if (args.tier === null) return null;

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
