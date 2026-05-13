# simlm — Codebase Map for AI Agents

## What this is

A SimSimi-style pattern-matching chatbot. **No LLM at runtime** — replies come from a curated/learned pattern store, scored by a 3-tier matching engine (exact → Postgres FTS → trigram). Built as a pnpm + Turbo monorepo so the public chat API, the internal admin API, and two Vite/React UIs share typed packages.

## Tech stack

- **Runtime:** Node.js 22, pnpm 11 (pinned via `packageManager`), Turbo 2.
- **Backend:** Hono.js on Node, Postgres 16 (FTS + `pg_trgm`).
- **Frontend:** Vite + React, Tailwind v4.
- **Tooling:** TypeScript 5.7, Prettier, tsx, valibot for env parsing, pino for logging.

## Monorepo layout

```
apps/
  api/         # public Hono REST + SSE, binds PORT on 0.0.0.0
  admin-api/   # internal Hono REST, binds ADMIN_PORT on 127.0.0.1
  web/         # public chat UI (Vite + React)
  admin/       # internal admin dashboard (Vite + React)
packages/
  config/      # valibot env schema
  types/       # shared DTOs
  normalizer/  # pure NFC + case + whitespace normalizer
  db/          # postgres client, migrations, repositories
  matcher/     # 3-tier matching engine
  logger/      # pino + redactInput() — shared by api + admin-api
  tsconfig/    # shared tsconfig bases
  eslint-config/ # shared flat eslint config
seeds/
  vi/          # hand-curated Vietnamese seeds
  chatterbot/  # snapshot of chatterbot-corpus YAML
docs/          # phased specs — see below
```

## Where the specs live

Phased build plan in `docs/SPEC_PHASE_0.md` … `docs/SPEC_PHASE_15.md`. Each spec includes Goals, Layout, Deliverables, Acceptance, and Prev/Next pointers. `docs/REQUIREMENTS.md` holds the top-level product brief. **Always read only the current phase's spec unless the work demands cross-phase context** — resist reading ahead.

## Key commands

- `pnpm dev` — turbo dev across all apps (Phase 2+).
- `pnpm db:up` / `pnpm db:down` / `pnpm db:reset` — Postgres dev container.
- `pnpm migrate` / `pnpm seed` / `pnpm seed:chatterbot` — db management via `@simlm/db`.
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` — turbo fan-out.

## Conventions

- **Workspace package naming:** every internal package is `@simlm/<name>` and `private: true`. Cross-package imports go through `@simlm/...` specifiers; pnpm wires them via `link-workspace-packages=true`.
- **Supply-chain embargo:** `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days). New deps published less than a week ago will refuse to resolve; the lockfile is the only thing that touches this gate, so CI's `--frozen-lockfile` is unaffected. To force-include an emergency patch, add it under `minimumReleaseAgeExclude` and review like normal code.
- **Postinstall allowlist:** `allowBuilds` in `pnpm-workspace.yaml` is the per-package permission list for postinstall scripts. Every entry is permission to run arbitrary code at install time — add deliberately, document why.
- **admin-api is a separate process bound to `127.0.0.1`:** the public `api` and internal `admin-api` never share a process. The admin API only accepts loopback connections; exposing it externally requires deliberate reverse-proxy work. This split is the security boundary, not a stylistic choice.
- **No LLM at runtime:** never add OpenAI/Anthropic/etc. SDKs to `apps/api`. The matcher in `@simlm/matcher` is the only thing that produces replies.

## Next phase

`docs/SPEC_PHASE_1.md` — Shared Package Skeletons. Starts filling in `packages/*` with their first real `package.json` (deps, scripts) and `tsconfig.json`/source skeletons.
