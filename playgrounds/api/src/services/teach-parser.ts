// Only `/teach` (case-insensitive) at the very start of the message — the
// space after the prefix is optional so '/teach' alone is parseable as
// "missing payload" rather than "not a teach command".
const PREFIX_RE = /^\/teach\b\s*/i;

// Explicit double-quoted form. Single quotes / escaped quotes are out of
// scope; if the user needs literal quotes inside, they can fall back to
// the implicit (reply-only) form.
const EXPLICIT_RE = /^"([^"]+)"\s*=>\s*"([^"]+)"$/;

export type ParsedTeach =
  | { ok: true; input: string | null; reply: string }
  | { ok: false; error: string };

/**
 * Parse a `/teach …` command.
 *
 *   /teach hi there!                        → reply-only; input pulled from session.last_input
 *   /teach "what's up" => "not much, you?"  → explicit input + reply
 */
export function parseTeachCommand(raw: string): ParsedTeach {
  if (!PREFIX_RE.test(raw)) return { ok: false, error: "not a teach command" };
  const body = raw.replace(PREFIX_RE, "").trim();
  if (!body) return { ok: false, error: "empty teach payload" };
  const explicit = EXPLICIT_RE.exec(body);
  if (explicit) {
    return { ok: true, input: explicit[1]!.trim(), reply: explicit[2]!.trim() };
  }
  return { ok: true, input: null, reply: body };
}

/** Cheap prefix probe — used by the chat handler to branch before parsing. */
export function looksLikeTeach(message: string): boolean {
  return PREFIX_RE.test(message);
}
