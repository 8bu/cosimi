/**
 * Canonical product/brand name for user-facing chrome. Merged into @cosimi/core
 * from the former @cosimi/branding package. Reference `BRAND.name` rather than
 * hardcoding the string so a rebrand is a one-line edit. (The old `withBrand()`
 * template helper was dropped — it only served the deleted web i18n, and keeping
 * core dep-free is worth more than a one-liner `{{ brand }}` substitution.)
 */
export const BRAND = {
  /** Cased for prose: titles, headers, embedded in sentences. */
  name: "Cosimi",
} as const;
