// Mimics server SSE pacing (apps/api/src/services/chat-handler.ts
// streamTokens) for client-rendered fallback messages. Fallback wording is
// FE-owned (see store.ts no_match branch), but it should feel like it
// streams from the server rather than snapping in instantly.
//
// Parity rules (kept in lockstep with apps/api/src/lib/tokenizer.ts):
//   - token mode only (matches server default SSE_DELAY_MODE=token)
//   - same split: text.split(/(\s+)/), drop empty parts
//   - per-token delay = uniform in [base-jitter, base+jitter], clamped at 0

const IS_TEST = import.meta.env.MODE === "test";
// Hardcoded constants on FE: server's env is not exposed to the browser,
// and parity is "feels similar", not "byte-for-byte same pacing".
const BASE_MS = IS_TEST ? 0 : 40;
const JITTER_MS = IS_TEST ? 0 : 80;

function jitterMs(base: number, jitter: number): number {
  if (jitter === 0) return base;
  const delta = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
  return Math.max(0, base + delta);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) resolve();
    else setTimeout(resolve, ms);
  });

export async function streamFallback(
  text: string,
  appendToken: (token: string) => void,
): Promise<void> {
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    const delay = jitterMs(BASE_MS, JITTER_MS);
    if (delay > 0) await sleep(delay);
    appendToken(part);
  }
}
