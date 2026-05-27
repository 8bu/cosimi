# Vietnamese Gen-Z Slang KB — Design

Date: 2026-05-28
Status: approved, ready for implementation plan

## Goal

Add a hand-curated-by-LLM Vietnamese Gen-Z slang knowledge base as a seed
file. Stress-tests the bot's coverage of casual / profane / code-switched
input, and exercises all four matcher tiers against high-variance phrasing.

## Scope

In:

- Single seed file `seeds/vi/genz-slang.yaml`.
- ~250 pairs covering 30–40 base slang terms.
- Topics: `slang-def`, `slang-react`, `slang-trans`, `slang-banter`.
- Full raw register; profanity (`vcl`, `sml`, `đm`, etc.) allowed.

Out:

- Regional dialect slang (Bắc/Trung/Nam specific).
- 2010s-era slang (`chuẩn cmnr` era) unless still in active use.
- English-only Gen-Z duplicates (mixed pairs OK; no en-locale doubles).
- Slurs, targeted hate, sexual content.

## Format

Flat YAML array per `seeds/vi/*.yaml` convention. Per-pair `topic` field
(no `--topic` CLI override — taxonomy is intrinsic to the file).

```yaml
- input: "gato là gì"
  response: "gato = ghen ăn tức ở. ai đó hơn mình tí là cay liền =))"
  topic: "slang-def"
- input: "gato vậy"
  response: "gato gì mà gato, sống cho thoải mái đi"
  topic: "slang-react"
```

Run: `pnpm seed seeds/vi/genz-slang.yaml --locale=vi`

## Topic taxonomy

| Topic | Pattern | Target share |
|---|---|---|
| `slang-def` | User asks `X là gì?` / `X nghĩa là gì?` → bot defines briefly + example | ~35% |
| `slang-react` | User uses slang in a statement → bot replies slangy in kind | ~35% |
| `slang-trans` | User asks for plain-Vietnamese equivalent → bot gives standard phrasing | ~15% |
| `slang-banter` | Generic Gen-Z banter; no specific term anchor | ~15% |

## Base term list (working draft)

flex, gato, ét o ét, ô dề, u là trời, mlem mlem, xỉu up xỉu down, ml² (ma
lanh / má lì), trẩu, trầm cảm, đỉnh chóp, peak, slay, vibe, drama, toxic,
suy, chằm Zn, ship, simp, real, sml, vcl, đm, vl, pha ke, gấu, tóp tóp,
ngân ép xi, j z chòi, chếc, ngon, đỉnh, hong, gòi, hong gòi.

Each base term gets 6–8 YAML rows distributed across the four topics.
A row counts whether it's a unique logical pair OR an input-phrasing
variant of an existing response. Roughly 60% unique pairs, 40% input
variants — variants drive fuzzy-match coverage so the trigram tier picks
up `gatoo`, `gáto`, `g a t o` without needing extra logical pairs. 30
terms × 7 rows ≈ 210 rows; banter (no anchor term) adds the remaining
~40 to reach the ~250 target.

## Matcher implications

- All pairs are locale-tagged `vi` at seed time; lookups still fall back
  to `und` per the matcher's `(locale = $1 OR locale = 'und')` rule.
- `topic` is metadata only; matcher does not score by topic. Topic exists
  for admin filtering and per-topic rollback via `import_batches`.
- High-variance input phrasings (2–3 per pair) widen the FTS + trigram
  surface so casual misspellings still match.

## Risks / open questions

- Profanity in seeds may surprise operators reading admin UI. Acceptable
  per design call (`Register: full raw`); document in seed header comment.
- `TEACH_BLOCKLIST_REGEX` does not affect seeds. If a future operator
  wants to filter slurs from `/teach` only, the seed file is untouched.
- Slang ages fast. Re-baseline the file every ~12 months or accept rot.

## Acceptance

- File seeded successfully (`pnpm seed:vi` includes it via the glob, or
  explicit invocation runs without error).
- Manual smoke-test: 5 randomly picked input phrasings each return a
  topical reply via `apps/web` chat.
- Admin pairs view filters cleanly by each of the four topics.
