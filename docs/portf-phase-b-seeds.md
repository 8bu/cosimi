# Phase B — portf seeds + matcher smoke (landed 2026-05-26)

- **The portf default locale is `'en'` end-to-end - seed CLI stamps it,
  matcher requires it in the request `locales`.** `pnpm seed:portf`'s
  root script ships `--locale=en`, which makes every seeded row's
  `pairs.locale='en'`. The matcher cascade filters
  `(locale = $1 OR locale = 'und')` per pass, so a request with default
  `locales=['und']` is **invisible** to `en`-only rows. Production
  `apps/portf` will send `locales=['en','und']` (per spec §4.3); ad-hoc
  curl smoke against `:3010/chat` MUST include the same. Do not "fix"
  this by seeding `--locale=und` - that would defeat the per-locale
  cascade that Phase 11.1 designed for.

- **`/chat` on a miss emits `no_match` as an SSE event, NOT fallback
  text tokens.** `chat-handler.ts:144-152` writes the `unanswered` row
  and emits `{type:'no_match'}`. The FE renders the locale-appropriate
  fallback from its own i18n dict - server stays out of UX chrome so the
  user can switch locales without a roundtrip. Smoke assertions against
  `/chat` should check for the `no_match` event in the SSE frames; do
  NOT grep for the literal `"hmm idk, tell me more?"` fallback string
  - it will never appear in the stream. (The `app_config.fallback_message_*`
  rows still exist for `apps/portf` and `apps/web` to read via a
  different endpoint should it ever want server-canonical strings.)

- **`pairs.locale` per row is the CLI flag, not the YAML field.** The
  seed CLI's `Pair` type at `packages/db/src/scripts/seed.ts:11` is
  `{ input, response, topic? }` - `locale` is read from the
  `--locale=<tag>` arg and stamped uniformly across the run's rows. The
  spec §9 example showing `locale: en` inside a YAML row is illustrative
  only; the loader silently discards it. Future seed files in
  `seeds/portf/` should NOT include `locale:` per row - adding it
  misleads readers into thinking per-row locale tagging works without
  the CLI flag.

- **The Phase A wrap-up note "`fallback_message_en` not present on
  portf" was incorrect.** Migration 010 (lines 28-32) unconditionally
  inserts all three `fallback_message_{und,vi,en}` rows on every fresh
  DB - `pnpm migrate:portf` ran 010 against portf, so the rows are
  present. No additional migration or seed step is needed for fallback
  text. Verifying observations against `psql` before adding work is
  cheap; do it before introducing migrations to "fix" a non-bug. (This
  one cost only a planning question, not actual code - but it's a
  reusable pattern.)

- **Phase B is intentionally data-only - zero app source changes.** No
  edits to `apps/api`, `apps/admin-api`, `apps/web`, `apps/admin`, or
  `packages/*`. The whole product surface is `seeds/portf/*.yaml` plus
  the rolled-up smoke verification. If Phase B ever needs a code change
  to land, that change belongs in Phase A (plumbing) or Phase F (matcher
  integration), not here. The phase boundary keeps blast radius
  predictable.

- **The `name='Bé Sim'` legacy app_config row is still on portf.** Per
  operator decision 2026-05-26: defer the portf-specific override
  (`name='Long Nguyễn'` per spec §9) to the dedicated real-corpus
  brainstorm session. The smoke seed does not use `{{ name }}`
  substitution, so this is a no-op for Phase B. When the override
  lands, it will not be via a migration - `ON CONFLICT DO UPDATE`
  would stomp the cosimi-side value, violating migration discipline.
  The chosen path is a per-DB one-shot SQL or a CLI script invoked
  only against the portf URL.
