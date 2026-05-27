# simlm: SimSimi-style chatbot

A pattern-matching chatbot in the spirit of SimSimi. **No LLM at runtime.**
Replies come from a curated/learned pattern store, scored by a four-tier
matching engine (`session_teach → exact → FTS → trigram`). Bilingual
(Vietnamese / English) seeds ship in-tree. pnpm + Turbo monorepo; the public
chat API, the internal admin API, and the two SPAs share typed packages.

## Why I built this

Curiosity. Wanted to play with the SimSimi-era chatbot shape: a language
matcher over a curated pattern store. No reasoning at runtime, no tokens
billed per turn, hallucinations bounded by what's in the table.

The twist vs. classic SimSimi: **LLM is the crowd now.** SimSimi sourced
its pairs from users at scale (uncurated). Here, an LLM bulk-generates
pairs offline and an admin reviews them; the `/teach` flow is for
incremental gap-filling, not the seed. The LLM runs at build/import time
only. Runtime is pure SQL.

The shape fits domains that don't need reasoning: greetings, jokes, FAQs,
small-talk, canned support replies. Postgres FTS + trigram do the fuzzy
match. `xin chào`, `xin chao`, and `xinchao` all hit the same row, no
embeddings, no API key.

## Docs

- **[Architecture](./docs/ARCHITECTURE.md)**: process split, matcher cascade, repo layout
- **[Setup](./docs/SETUP.md)**: first-time install, seed, dev commands
- **[Configuration](./docs/CONFIGURATION.md)**: env vars, logging, PII
- **[API](./docs/API.md)**: `curl` recipes + deployment security model
- **[LLM Import Format](./docs/LLM_IMPORT_FORMAT.md)**: bulk-import file shape
- **[CLAUDE.md](./CLAUDE.md)**: conventions, invariants, "don't repeat this mistake" rules
- **`docs/SPEC_PHASE_*.md`**: per-phase specs, in build order

## Quickstart

```bash
nvm use && corepack enable
pnpm install
cp .env.example .env
pnpm dev:all                       # postgres → migrate → api + admin-api + web
pnpm --filter @simlm/admin dev     # admin SPA on :5174
pnpm seed                          # vi + chatterbot corpus
```

Full setup: [`docs/SETUP.md`](./docs/SETUP.md).

## Project status

**Work in progress.** Phases 0–16 are merged on `main` and the standing
gates (`typecheck`, `lint`, `format:check`, `test`) are green, but this repo
is also a trial run for a larger portfolio app I'm building, so expect churn.
The matcher, schema, and admin surface are the parts most likely to shift as
I pull patterns out into the portfolio project and feed lessons back here.

Out of scope for now (may change):

- Internationalization of UI chrome. Chat content is bilingual (vi/en) but
  the admin chrome is English-only.
- Multi-user accounts / sharing. Single-user-per-browser by design.
- Telemetry / observability dashboards. Pino → stdout → your log pipeline is
  the v1 story.

## Credits

- Vietnamese seed data: hand-curated.
- English seed data: [chatterbot-corpus](https://github.com/gunthercox/chatterbot-corpus)
  by Gunther Cox, BSD-3 license. See
  [`seeds/chatterbot/LICENSE`](./seeds/chatterbot/LICENSE) and
  [`seeds/chatterbot/NOTICE`](./seeds/chatterbot/NOTICE).
