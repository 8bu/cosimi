// Sentence splitting + crude HTML→text. Deliberately dependency-free and
// heuristic: HTML *structure* parsing is deferred (spec E1), so HTML here is
// flattened to plain text and handed to the embedding-based chunker.

/**
 * Split text into sentences. Blank lines are hard boundaries; within a line,
 * `.`/`!`/`?` (optionally followed by closing quotes/brackets) end a sentence.
 * Trims and drops empties. Diacritics are preserved (Unicode-safe).
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    // Split after sentence-final punctuation + trailing quotes, on following space.
    const parts = trimmed.split(/(?<=[.!?]["')\]]?)\s+/u);
    for (const p of parts) {
      const s = p.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Flatten HTML to plain text: drop <script>/<style> bodies, strip all tags,
 * decode the common named/numeric entities, collapse whitespace. Crude but
 * sufficient for the deferred-HTML path (spec E1).
 */
export function htmlToText(html: string): string {
  let s = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&[a-z]+;|&#\d+;/gi, (m) => {
    if (m in ENTITIES) return ENTITIES[m]!;
    const num = /^&#(\d+);$/.exec(m);
    return num ? String.fromCodePoint(Number(num[1])) : m;
  });
  return s.replace(/\s+/g, " ").trim();
}
