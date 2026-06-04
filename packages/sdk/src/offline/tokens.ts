import { encode } from "gpt-tokenizer";

/**
 * Approximate token count via the o200k BPE encoder (gpt-tokenizer). Used only
 * for chunk-size thresholds (split >600, target 150–400); exactness isn't
 * required, so any BPE tokenizer's count is fine. Offline-only import — never
 * pulled into the Workers runtime entry.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return encode(text).length;
}
