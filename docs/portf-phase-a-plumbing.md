# Phase A — workspace plumbing (landed 2026-05-26)

Per-phase discovery log. Discipline rules captured during implementation
that should eventually fold into the root `CLAUDE.md`. Do not edit
`CLAUDE.md` from feature work — write here, fold later. One entry per
non-obvious rule: lead with the rule, then the rationale with concrete
file paths, then call out the trap that would break it.

- **`.env.portf` is the single source of truth for the second product's
  config.** Both `apps/api` and `apps/admin-api` have a `dev:portf`
  script that loads it (via `tsx --env-file=../../.env.portf`). Never
  create a third env file or in-process multi-tenancy router - the
  contract is: one env file → one set of process-instances.

- **`db/init/01_portf.sql` only runs on fresh container volumes.**
  Postgres' `/docker-entrypoint-initdb.d/` runs once per volume init. For
  existing dev volumes, use `pnpm provision:portf` - it connects to the
  `postgres` maintenance DB and idempotently `CREATE DATABASE portf`s.
  This is why we keep both: docker init for clean setups, the script for
  upgrade-in-place.

- **Root `migrate` script no longer uses `pnpm --filter @simlm/db`.**
  Direct `tsx --env-file=.env packages/db/src/migrate.ts up` works because
  the runner resolves `MIGRATIONS_DIR` file-relative via
  `new URL("../migrations", import.meta.url)`, not cwd-relative. If a
  contributor refactors the migrate runner to be cwd-aware, the root
  script breaks - keep the file-relative resolution.

- **`dev:simlm` and `dev:portf` are siblings; `dev` is a deprecated
  alias of `dev:simlm`.** Drop the alias when CI + docs no longer
  reference plain `dev`. There is no `dev:all` for portf alone
  (deliberate - two product stacks in one terminal is too noisy; run each
  in its own).

- **`apps/admin`'s Vite proxy now reads `VITE_ADMIN_API_TARGET`.**
  Default unchanged (`http://127.0.0.1:3001` = simlm admin-api). Set to
  `http://127.0.0.1:3011` at launch to manage the portf product instead.
  One SPA, two targets - operator switches sessions. Adding application-
  layer auth here would imply external exposure is safe (it isn't); the
  loopback boundary is the security model. Same rule as the existing
  admin-api binding.

- **The `provision-portf-db.ts` script lives at
  `packages/db/src/scripts/`, not `scripts/` at root.** The original
  Phase A plan put it at root; review forced relocation because the
  script needs `postgres` + `vitest` deps that only exist in workspace
  packages. The `#scripts/*` subpath alias in `packages/db/package.json`
  imports the test cleanly. If a future operator script needs the same
  treatment, follow this pattern: put it in `packages/db/src/scripts/`
  and reference it from root scripts via the full path.

- **Turbo can fan a script across packages with `turbo run <task>` -
  packages without the task are silently skipped.** `dev:portf` fans
  across @simlm/api + @simlm/admin-api (and eventually @portf/web in
  Phase C). The other 12 workspaces show `<NONEXISTENT>` in `--dry-run`
  output and are simply ignored. No need to filter; turbo handles it.

- **Killing `turbo run dev:portf` externally (e.g., `kill <pid>`) does
  not propagate SIGTERM to child node processes - they leak the bound
  ports.** Use `Ctrl-C` in the foreground (the standard interactive
  shutdown) which works correctly. If you scripted the shutdown
  (background process + kill), follow up with `lsof -nP -iTCP:3010
  -sTCP:LISTEN` and explicit `kill -9` on the listed PIDs. This is a
  known turbo behavior, not a bug in our code.

- **`pnpm seed:portf` requires `seeds/portf/*.yaml` to exist (Phase B
  creates the dir).** The script's positional glob expands in the shell
  before tsx runs. Under zsh (the dev environment), an unmatched glob
  raises `zsh: no matches found: seeds/portf/*.yaml` and the script
  never starts. Phase B must create at least one file under `seeds/portf/`
  (e.g., the planned `_placeholder.yaml` smoke seed) before `seed:portf`
  is runnable. No defensive change in Phase A - adding a `.gitkeep`
  wouldn't help (still no `.yaml` match) and pre-creating an empty seed
  file would be off-scope for plumbing.
