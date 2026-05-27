# simlm: SimSimi-style chatbot

Pattern-matching chatbot in spirit of SimSimi. **No LLM at runtime.**
Replies from curated/learned pattern store, scored by four-tier
matching engine (`session_teach → exact → FTS → trigram`).

## Why I built this

Curiosity. Wanted play with SimSimi-era chatbot shape: language
matcher over curated pattern store. No reasoning at runtime, no tokens
billed per turn, hallucinations bounded by what's in table.

Twist vs classic SimSimi: **LLM is crowd now.** SimSimi sourced
pairs from users at scale (uncurated). Here, LLM bulk-generates
pairs offline, admin reviews them; `/teach` flow for
incremental gap-filling, not seed. LLM runs at build/import time
only. Runtime pure SQL.

Shape fits domains needing no reasoning: greetings, jokes, FAQs,
small-talk, canned support replies. Postgres FTS + trigram do fuzzy
match. `xin chào`, `xin chao`, `xinchao` all hit same row, no
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

**Work in progress.** Phases 0–16 merged on `main`, standing
gates (`typecheck`, `lint`, `format:check`, `test`) green, but repo
also trial run for larger portfolio app I'm building, so expect churn.
Matcher, schema, admin surface most likely to shift as
I pull patterns out into portfolio project and feed lessons back here.

Out of scope for now (may change):

- Internationalization of UI chrome. Chat content bilingual (vi/en) but
  admin chrome English-only.
- Multi-user accounts / sharing. Single-user-per-browser by design.
- Telemetry / observability dashboards. Pino → stdout → your log pipeline
  v1 story.

## Credits

- Vietnamese seed data: hand-curated.
- English seed data: [chatterbot-corpus](https://github.com/gunthercox/chatterbot-corpus)
  by Gunther Cox, BSD-3 license. See
  [`seeds/chatterbot/LICENSE`](./seeds/chatterbot/LICENSE) and
  [`seeds/chatterbot/NOTICE`](./seeds/chatterbot/NOTICE).