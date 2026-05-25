// Mustache-ish placeholder syntax: `{{ name }}` (whitespace tolerant,
// case-insensitive). Keys are restricted to identifier-shape so the regex
// can't accidentally chew on expression-like text. Unknown keys are LEFT
// LITERAL — that surfaces typos in seed corpora (the operator sees the
// placeholder still present in the reply) instead of silently emitting
// empty text.
const PLACEHOLDER_RE = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER_RE, (match, key: string) => {
    const lookup = key.toLowerCase();
    return Object.hasOwn(vars, lookup) ? vars[lookup]! : match;
  });
}
