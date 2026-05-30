/**
 * V2 spotlight tuning constants.
 *
 * Not env-driven - these tune off real visitor input, not deploy config.
 * Adjust here when the typing animation feels too fast/slow.
 */

/** Milliseconds between character appends during chip typing animation. */
export const TYPING_ANIM_MS_PER_CHAR = 40;

/** Milliseconds after typing completes before auto-submit fires. */
export const AUTO_SUBMIT_DELAY_MS = 250;
