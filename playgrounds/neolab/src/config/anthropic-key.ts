const STORAGE_KEY = "cosimi.config.anthropicKey";

/**
 * Operator's Anthropic API key, managed entirely client-side and sent per
 * request as X-Anthropic-Key (ingest). The server holds no LLM secret. NEVER
 * log this. localStorage is acceptable — admin-api is loopback + single operator.
 */
export function getAnthropicKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAnthropicKey(value: string): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled */
  }
}
