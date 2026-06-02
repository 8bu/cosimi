/**
 * Suggestion chip pool.
 *
 * Each `label` is sent VERBATIM as a chat input, so every label must match a
 * curated seed pair on the exact tier. The matcher normalizes input (NFC +
 * lowercase + whitespace collapse, punctuation preserved) before comparing, so
 * labels may be display-cased ("Best project" -> "best project") but trailing
 * punctuation must match the paired input exactly.
 *
 * The UI shows a random 5 of this pool via `useSampledChips`; the first 5
 * entries are stable "hero" chips rendered during prerender / no-JS.
 *
 * English-only in this phase - i18n (Phase H) will move labels + marks to a
 * translation dict.
 */
export const SUGGESTION_CHIPS = [
  // --- hero (stable first-5, shown during prerender / no-JS) ---
  { mark: "🚀", label: "Best project" },
  { mark: "🤝", label: "Why hire you" },
  { mark: "🧰", label: "Tech stack" },
  { mark: "☕", label: "Coffee chat" },
  { mark: "🗓️", label: "Available for hire" },
  // --- hiring / fit ---
  { mark: "💪", label: "Your strengths" },
  { mark: "🧭", label: "What makes you different" },
  { mark: "⏳", label: "When can you start" },
  { mark: "🧱", label: "What value do you bring" },
  // --- story / identity ---
  { mark: "👋", label: "Introduce yourself" },
  { mark: "🆔", label: "What does 8bu mean" },
  { mark: "🎂", label: "How old are you" },
  { mark: "🌏", label: "Where do you live" },
  { mark: "📜", label: "How did you start coding" },
  { mark: "🎓", label: "Education" },
  // --- career ---
  { mark: "🏢", label: "Where do you work" },
  { mark: "🧗", label: "Walk me through your career" },
  { mark: "🧮", label: "How many years experience" },
  { mark: "✈️", label: "What is WegoPro" },
  { mark: "🔭", label: "Are you looking for a job" },
  // --- stack / craft ---
  { mark: "🟩", label: "Do you know Vue" },
  { mark: "⚛️", label: "Do you know React" },
  { mark: "🔷", label: "TypeScript?" },
  { mark: "🎨", label: "Tailwind?" },
  { mark: "🧪", label: "Testing experience" },
  { mark: "🤖", label: "AI tools you use" },
  { mark: "🖥️", label: "Your terminal" },
  // --- projects ---
  { mark: "🌉", label: "Tell me about the Nuxt migration" },
  { mark: "🪙", label: "What is Multiplier" },
  { mark: "🛰️", label: "What is SuperLauncher" },
  { mark: "🧩", label: "What is Cosimi" },
  { mark: "🔗", label: "DeFi experience" },
  { mark: "👛", label: "Tell me about the wallet module" },
  { mark: "🧑‍🏫", label: "Mentoring experience" },
  { mark: "🎤", label: "Have you conducted technical interviews?" },
  // --- opinions ---
  { mark: "⚖️", label: "Vue or React" },
  { mark: "🧵", label: "Tailwind or SCSS" },
  { mark: "🧠", label: "How do you feel about testing" },
  // --- personality / life ---
  { mark: "🎮", label: "Hobbies" },
  { mark: "🐕", label: "Do you have pets" },
  { mark: "🗣️", label: "What languages do you speak" },
  { mark: "🦀", label: "Rust?" },
  { mark: "🏠", label: "Do you work remote" },
  // --- contact / meta ---
  { mark: "📧", label: "How to contact you" },
  { mark: "🐙", label: "GitHub" },
  { mark: "💼", label: "LinkedIn" },
  { mark: "💬", label: "Is this an LLM" },
  { mark: "🔌", label: "What powers this chat" },
  { mark: "🆚", label: "Which is better Vue or React" },
  { mark: "🧷", label: "Let's chat" },
] as const;

export type SuggestionChip = (typeof SUGGESTION_CHIPS)[number];

/** Fisher-Yates pick of `n` distinct chips (or the whole pool if smaller). */
export function sampleChips<T>(pool: readonly T[], n: number): T[] {
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a.slice(0, Math.min(n, a.length));
}
