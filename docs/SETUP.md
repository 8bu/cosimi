# Setup & Development

## Prerequisites

Node 22, Docker (for Postgres), and corepack.

## First-time setup

```bash
git clone <repo>
cd simlm
nvm use                 # or: nvm install 22 && nvm use 22
corepack enable         # pnpm version is pinned via packageManager

pnpm install
cp .env.example .env    # defaults are good for local dev

# One-button start: guards Docker, brings up Postgres (waits for
# healthcheck), runs migrations, starts api + admin-api + web via turbo.
pnpm dev:all

# Then in a second terminal, start the admin SPA:
pnpm --filter @simlm/admin dev
```

The first time you boot, the matcher has nothing to match against. Seed it:

```bash
pnpm seed               # loads seeds/vi/*.yaml + seeds/chatterbot/*.yml
# …or selectively:
pnpm seed:vi
pnpm seed:chatterbot
```

To start clean (drops the Postgres volume):

```bash
pnpm db:reset && pnpm migrate && pnpm seed
```

## Development commands

```bash
pnpm dev:all       # one-shot: guards Docker, then db:up (waits for healthy) → migrate → dev
pnpm dev           # turbo: api + admin-api + web
pnpm --filter @simlm/admin dev   # start the admin SPA (port 5174)

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

> ⚠️ The matcher, api, and admin-api test suites all share the
> `simlm_test` database. Run with `pnpm -r --workspace-concurrency=1 test`
> to avoid parallel test-suite setups stomping on each other (see
> [`../CLAUDE.md`](../CLAUDE.md) for details).
