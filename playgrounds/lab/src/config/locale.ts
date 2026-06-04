// The lab is English-only chrome; retrieval still sends a pair-locale filter.
// Centralized so a future locale picker is one edit.
export function getLocales(): string[] {
  return ["en", "und"];
}
