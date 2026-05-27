# simlm — SimSimi-style chatbot

A pattern-matching chatbot in the spirit of SimSimi. **No LLM at runtime** —
replies come from a curated/learned pattern store, scored by a four-tier
matching engine (`session_teach → exact → FTS → trigram`). Bilingual
(Vietnamese / English) seeds ship in-tree. pnpm + Turbo monorepo; the public
chat API, the internal admin API, and the two SPAs share typed packages.

## Why I built this

Most chatbots reach for an LLM by default now. For a lot of use cases that's
fine. But a chunk of the conversational surface area I actually care about —
greetings, jokes, canned support answers, a "what's your name" FAQ, a
Vietnamese small-talk corpus — doesn't need reasoning. It needs a reliable
lookup over a small, curated knowledge base.

**LM (Language Matcher) is cheaper and more reliable than a big LLM with RAG
or GraphRAG for that shape of problem.** No tokens billed per turn. No
hallucinations. No "the model paraphrased the answer and lost the joke." No
vector store to keep in sync, no embedding model to version, no prompt to
tune. The data *is* the behavior: edit a row, the bot changes. Teach the bot
inline via `/teach`, an admin approves it from a queue, and the next user
gets the new reply.

The four-tier cascade (exact → Postgres FTS → trigram → session override)
covers the long tail without ML. Postgres handles fuzzy matching well enough
that a 10k-pair corpus answers `xin chào` and `xin chao` and `xinchao` the
same way, in single-digit milliseconds, without an API key.

I also wanted to prove out a few things along the way: Hono on Node, Tailwind
v4 CSS-first, a strict typed-DTO contract across two processes, and a phased
build that's actually reviewable. The whole repo is laid out so each phase's
spec lives next to the code it produced.

## Docs

- **[Architecture](./docs/ARCHITECTURE.md)** — process split, matcher cascade, repo layout
- **[Setup](./docs/SETUP.md)** — first-time install, seed, dev commands
- **[Configuration](./docs/CONFIGURATION.md)** — env vars, logging, PII
- **[API](./docs/API.md)** — `curl` recipes + deployment security model
- **[LLM Import Format](./docs/LLM_IMPORT_FORMAT.md)** — bulk-import file shape
- **[CLAUDE.md](./CLAUDE.md)** — conventions, invariants, "don't repeat this mistake" rules
- **`docs/SPEC_PHASE_*.md`** — per-phase specs, in build order

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

**Complete.** All 16 phases (0–15) are merged on `main`. **211 tests across
8 suites** (api + admin-api + matcher + web + admin + normalizer + template +
i18n). Standing gates green.

Deferred to potential future work — explicitly out of scope for the MVP:

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
