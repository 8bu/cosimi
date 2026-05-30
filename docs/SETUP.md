# Setup & Development

## Prerequisites

Node 22, Docker (Postgres), corepack.

## First-time setup

```bash
git clone <repo>
cd cosimi
nvm use                 # or: nvm install 22 && nvm use 22
corepack enable         # pnpm version is pinned via packageManager

pnpm install
cp .env.example .env    # defaults are good for local dev

# One-button start: guards Docker, brings up Postgres (waits for
# healthcheck), runs migrations, starts api + admin-api + web via turbo.
pnpm dev:all

# Then in a second terminal, start the admin SPA:
pnpm --filter @cosimi/admin dev
```

First boot: matcher empty. Seed:

```bash
pnpm seed               # loads seeds/vi/*.yaml + seeds/chatterbot/*.yml
# …or selectively:
pnpm seed:vi
pnpm seed:chatterbot
```

Clean start (drops Postgres volume):

```bash
pnpm db:reset && pnpm migrate && pnpm seed
```

## Development commands

```bash
pnpm dev:all       # one-shot: guards Docker, then db:up (waits for healthy) → migrate → dev
pnpm dev           # turbo: api + admin-api + web
pnpm --filter @cosimi/admin dev   # start the admin SPA (port 5174)

pnpm typecheck     # tsc --noEmit across the workspace
pnpm lint          # oxlint
pnpm format        # oxfmt
pnpm format:check  # oxfmt --check
pnpm test          # vitest across all packages
pnpm build         # turbo build

pnpm db:up         # docker compose: Postgres (blocks until healthcheck passes)
pnpm db:down
pnpm db:reset      # drops the volume; combine with migrate + seed for a clean slate

pnpm migrate       # apply pending migrations
pnpm seed          # all seed files
pnpm seed:vi
pnpm seed:chatterbot
```

> ⚠️ Matcher, api, admin-api test suites share `cosimi_test` db. Run `pnpm -r --workspace-concurrency=1 test` to avoid parallel setups stomping each other (see [`../CLAUDE.md`](../CLAUDE.md)).