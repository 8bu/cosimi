/**
 * Phase E chat-feature constants. All exported from one module so a
 * future tweak (real-visitor feedback, perf tuning) lands in one diff.
 */

/** Truncate the first user message to this many chars for the sidebar title. */
export const TITLE_MAX_LEN = 48;

/** Debounce window for the messages-store persistence write. */
export const PERSIST_DEBOUNCE_MS = 200;

/**
 * No-match fallback pool. The messages-store picks a random entry per
 * `no_match` event so back-to-back misses don't repeat verbatim. Tone is
 * "rephrase / different angle" - portfolio surface is read-only, NO
 * `/teach` (so no "teach me?" variants like apps/web's pool).
 *
 * Phase H replaces with i18n dict lookup (vi + en pools, same shape).
 */
export const FALLBACK_EN_POOL = [
  "hmm, that's outside what I'm dialed in on - try rephrasing?",
  "not sure I follow - mind asking it another way?",
  "blank on that one - could you be more specific?",
  "I don't have a story for that - try a different angle?",
  "that's outside the corpus - rephrase and I'll take another shot?",
] as const;

/**
 * Per-char delay for the client-side fake-stream of `no_match` fallback
 * text. Server emits `no_match` as a single event (no token stream); the
 * client paces the fallback char-by-char so the "thinking" UX matches
 * matched-reply token streaming. Synced to server's SSE_DELAY_BASE_MS=5 /
 * JITTER_MS=3 in `.env.portf` so matched and no-match replies pace
 * identically.
 */
export const FAKE_STREAM_BASE_MS = 5;
export const FAKE_STREAM_JITTER_MS = 3;
