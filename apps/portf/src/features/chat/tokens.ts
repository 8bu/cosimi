/**
 * Phase E chat-feature constants. All exported from one module so a
 * future tweak (real-visitor feedback, perf tuning) lands in one diff.
 */

/** Truncate the first user message to this many chars for the sidebar title. */
export const TITLE_MAX_LEN = 48;

/** Debounce window for the messages-store persistence write. */
export const PERSIST_DEBOUNCE_MS = 200;

/**
 * Hardcoded fallback line rendered into a bot bubble when the server
 * emits `no_match`. Phase H replaces with i18n dict lookup (single
 * English string until then).
 */
export const FALLBACK_EN = "hmm, I don't have a good answer for that — try rephrasing?";
