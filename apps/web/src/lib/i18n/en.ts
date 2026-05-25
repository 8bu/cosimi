// English mirror of vi.ts. Every key in vi.ts MUST exist here with the
// same value shape — string keys stay strings, array keys stay arrays.
// `typeof vi` is the type contract; the i18n test asserts dict
// completeness at runtime as a backstop.

import type { vi } from "./vi";

export const en: typeof vi = {
  "header.subtitle": "A pattern-matching chatbot · {{ count }} pairs learned",
  "role.you": "YOU",
  "role.you.teaching": "YOU · TEACHING",
  "role.bot": "{{ brand }}",
  "badge.exact": "exact match",
  "badge.fts": "partial match",
  "badge.trigram": "fuzzy match",
  "badge.session_teach": "from your last teach",
  "badge.lowConfidence": "low confidence",
  "badge.noMatch": "no match",
  "badge.score": "score",
  "badge.fromLocale": "matched in {{ locale }}",
  "cta.teachBetter": "Teach a better reply",
  "composer.placeholder": "Message {{ brand }}… or /teach <reply>",
  "composer.hint":
    "Type /teach <reply> to teach a response for your last message. Enter to send · Shift+Enter for newline.",
  "composer.send": "Send",
  "teach.prompt": "What should I have said?",
  "teach.promptFor": "What should I have said to {{ input }}?",
  "teach.cancel": "Cancel",
  "teach.submit": "Teach",
  "system.learned": "learned! i'll remember that next time.",
  "vote.up": "Upvote",
  "vote.down": "Downvote",
  "localeSwitcher.label": "Language",
  "noMatch.fallback": [
    "hmm idk, tell me more?",
    "no clue what that means — teach me?",
    "that's new to me, mind explaining?",
    "hmm, can you say more about that?",
    "i don't know that one yet — teach me?",
  ],
};
