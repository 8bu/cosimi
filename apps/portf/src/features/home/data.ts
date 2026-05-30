/**
 * V2 spotlight suggestion chips.
 *
 * Mirrors the design source's `SUGGESTION_CHIPS` constant
 * (docs/superpowers/artifacts/simlm2/project/primitives.jsx:188-193).
 *
 * English-only in Phase D - i18n lands in Phase H, which will move these
 * labels to a translation dict and read mark glyphs from there too.
 */
export const SUGGESTION_CHIPS = [
  { mark: "🚀", label: "Best project" },
  { mark: "🧰", label: "Stack" },
  { mark: "🤝", label: "Why hire me?" },
  { mark: "☕", label: "Coffee chat?" },
] as const;

export type SuggestionChip = (typeof SUGGESTION_CHIPS)[number];
