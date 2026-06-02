export type TokenizeMode = "char" | "token";

/**
 * Split `text` into a stream of chunks for SSE pacing.
 *   - char mode: one Unicode code-point per chunk (via the string iterator)
 *   - token mode: split on whitespace runs, keeping the runs as their own
 *     chunks so reconstructing the original string by concatenation is loss-
 *     less.
 */
export function* tokenize(text: string, mode: TokenizeMode): Generator<string> {
  if (mode === "char") {
    for (const ch of text) yield ch;
    return;
  }
  // token mode: split keeping whitespace runs as their own tokens
  for (const part of text.split(/(\s+)/)) {
    if (part) yield part;
  }
}

/**
 * Return `base ± jitter` ms, clamped at 0. With jitter=0 the value is
 * deterministic — useful for tests that disable pacing via env.
 */
export function jitterMs(base: number, jitter: number): number {
  if (jitter === 0) return base;
  const delta = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
  return Math.max(0, base + delta);
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) resolve();
    else setTimeout(resolve, ms);
  });
