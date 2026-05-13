# simlm — Codebase Map for AI Agents

## What this is

A SimSimi-style pattern-matching chatbot. **No LLM at runtime** — replies come from a curated/learned pattern store, scored by a 3-tier matching engine (exact → Postgres FTS → trigram). Built as a pnpm + Turbo monorepo so the public chat API, the internal admin API, and two Vite/React UIs share typed packages.

## Tech stack

- **Runtime:** Node.js 22, pnpm 11 (pinned via `packageManager`), Turbo 2.
- **Backend:** Hono.js on Node, Postgres 16 (FTS + `pg_trgm`).
- **Frontend:** Vite + React, Tailwind v4.
- **Tooling:** TypeScript 5.7, oxlint + oxfmt (oxc-project), tsx, valibot for env parsing, pino for logging, vitest for tests.

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
  oxlint-config/ # shared oxlint ruleset (JSON)
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
- **Env loading is a function call, not a module-load side effect.** `@simlm/config` exports `loadEnv()` — each consumer (api, admin-api, logger) calls it *once at startup*, not at import time. Importing the module does not read `process.env`, which keeps the module graph pure and lets tests inject synthetic env via `v.parse(EnvSchema, fakeEnv)`. Do not introduce a top-level `export const env = loadEnv()` singleton — that re-couples imports to the environment.
- **Diacritic-stripping split:** `@simlm/normalizer` does NFC + lowercase + whitespace **but preserves diacritics**. Postgres handles diacritic-stripping server-side via the `f_unaccent(text)` `IMMUTABLE` wrapper around the `unaccent` extension (defined in `001_extensions.sql`). All three matching tiers compare against `f_unaccent(...)`, never raw `unaccent(...)` — the underlying `unaccent()` is `STABLE`, which Postgres refuses to embed in expression indexes or generated columns. Both write-time and query-time paths run the same JS→SQL pipeline, so the comparison key stays symmetric. Do not add `.replace(/[̀-ͯ]/g, '')` or similar to the JS normalizer — it would diverge from the server side.
- **`pairs.normalized_unaccented` is `GENERATED ALWAYS AS (f_unaccent(normalized_input)) STORED`.** Writers update `normalized_input`; Postgres regenerates the unaccented form. Never `INSERT` or `UPDATE` `normalized_unaccented` directly — Postgres rejects it with `cannot insert a non-DEFAULT value into column`. The column is `STORED` (not virtual) precisely so all three matching indexes can sit on it.
- **Migration discipline:** files in `packages/db/migrations/` are numbered, additive, and **never rewritten after merge** — once a migration is on `main`, new schema changes go in a new file. The `_migrations` tracking table records what's been applied; the runner refuses to re-apply or re-order existing files. `pnpm migrate reset` is dev-only — guarded by a `NODE_ENV !== 'production'` check in `migrate.ts` and meant for blowing away the local dev DB to start clean.
- **One canonical write path for `pairs`.** `@simlm/db` exports `insertPair` and `insertManyPairs` — every writer (the seed CLI, the eventual admin import endpoint, admin-manual-add) goes through these. The bulk helper deliberately enumerates columns: `input`, `normalized_input`, `response`, `source`, `topic`, `batch_id`, `flagged`. **Never list `normalized_unaccented`** in that column list — Phase 2 made it `GENERATED ALWAYS … STORED` and Postgres rejects explicit values for it. Normalization happens once in JS via `@simlm/normalizer`; the unaccented form is regenerated server-side.
- **`@simlm/db` subpath import aliases.** The package exposes only `.` to outside consumers (the public surface). Internally it uses `#client`, `#repositories/*`, and `#scripts/*` — defined in `packages/db/package.json`'s `imports` field. New repository or script files automatically resolve under the wildcard, so adding `packages/db/src/repositories/foo.ts` is importable as `#repositories/foo` without touching `package.json`. Outside the `db` package, always import via `@simlm/db`, never via `#`.
- **Seed CLI format detection.** `packages/db/src/scripts/seed.ts` dispatches by file extension: `.json` (array), `.jsonl` (one object per line), and `.yaml`/`.yml` (flat list, unless the file has a top-level `conversations:` or `categories:` key — then it's parsed as chatterbot-corpus and flattened with a sliding window over each thread). Format is positional; no per-file flag. Globs are expanded by the shell, not the CLI.
- **Every seed run creates an `import_batches` row.** `seedFile()` calls `createBatch` → `insertManyPairs(..., batch_id)` → `setBatchCount`. The batch row is the unit of rollback (used by the admin endpoint in Phase 6), so the seed CLI must never bulk-insert without one. Re-running a seed is **expected** to create duplicate rows — the per-batch `note` records the source file path and the batch id, so duplicates are traceable and roll-back-able.
- **Root convenience scripts invoke `tsx` directly, not `pnpm --filter`.** `pnpm seed:vi` etc. run `tsx packages/db/src/scripts/seed.ts seeds/vi/*.yaml` from the workspace root, because `pnpm --filter <pkg> exec` would `cd` into `packages/db/` and the shell's glob expansion would then fail to match `seeds/vi/*` (which lives at the repo root). The `#client` / `#repositories/*` subpath imports still resolve correctly because Node looks up subpath imports against the nearest `package.json` containing the importing file, which is `packages/db/package.json` regardless of cwd.
- **`seeds/chatterbot/` is a frozen upstream snapshot.** Files are copied verbatim from `gunthercox/chatterbot-corpus` at the commit SHA pinned in `seeds/chatterbot/NOTICE`. The directory is in `.oxfmtignore` so re-formatting can't drift the snapshot away from the upstream pin. BSD-3 attribution lives in the root README; the full license text is `seeds/chatterbot/LICENSE`. **No postinstall network fetch** — refreshing is a manual, deliberate act (bump the SHA in `NOTICE`, re-fetch the four `.yml` files at that SHA, re-seed).

## Next phase

`docs/SPEC_PHASE_4.md` — Matching Engine. Implements the 3-tier matcher (exact → FTS → trigram) over the seeded `pairs` table.
