# CLAUDE.note.md — pending CLAUDE.md updates

A running buffer of rules learned in implementation that should eventually
fold into the root `CLAUDE.md`. A separate agent will integrate these into
the main file's structure in a future task. **Do not edit `CLAUDE.md` from
work that touches this file** — write here, fold later.

## Format

One section per phase. Each entry: a single paragraph of CLAUDE.md-style
guidance — start with the rule, then explain why with concrete file paths
or migration numbers, then call out the trap that would break it. Keep
entries terse and self-contained so the curation pass can move them
anywhere in `CLAUDE.md` without re-reading the source.

## apps/portf — pending entries

(Populated as phases A–H land. Anticipated entries are listed in
`docs/superpowers/specs/2026-05-26-portf-design.md` §13.)

## Phase A — workspace plumbing (landed 2026-05-26)

- **`.env.portf` is the single source of truth for the second product's
  config.** Both `apps/api` and `apps/admin-api` have a `dev:portf`
  script that loads it (via `tsx --env-file=../../.env.portf`). Never
  create a third env file or in-process multi-tenancy router — the
  contract is: one env file → one set of process-instances.

- **`db/init/01_portf.sql` only runs on fresh container volumes.**
  Postgres' `/docker-entrypoint-initdb.d/` runs once per volume init. For
  existing dev volumes, use `pnpm provision:portf` — it connects to the
  `postgres` maintenance DB and idempotently `CREATE DATABASE portf`s.
  This is why we keep both: docker init for clean setups, the script for
  upgrade-in-place.

- **Root `migrate` script no longer uses `pnpm --filter @simlm/db`.**
  Direct `tsx --env-file=.env packages/db/src/migrate.ts up` works because
  the runner resolves `MIGRATIONS_DIR` file-relative via
  `new URL("../migrations", import.meta.url)`, not cwd-relative. If a
  contributor refactors the migrate runner to be cwd-aware, the root
  script breaks — keep the file-relative resolution.

- **`dev:simlm` and `dev:portf` are siblings; `dev` is a deprecated
  alias of `dev:simlm`.** Drop the alias when CI + docs no longer
  reference plain `dev`. There is no `dev:all` for portf alone
  (deliberate — two product stacks in one terminal is too noisy; run each
  in its own).

- **`apps/admin`'s Vite proxy now reads `VITE_ADMIN_API_TARGET`.**
  Default unchanged (`http://127.0.0.1:3001` = simlm admin-api). Set to
  `http://127.0.0.1:3011` at launch to manage the portf product instead.
  One SPA, two targets — operator switches sessions. Adding application-
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

- **Turbo can fan a script across packages with `turbo run <task>` —
  packages without the task are silently skipped.** `dev:portf` fans
  across @simlm/api + @simlm/admin-api (and eventually @portf/web in
  Phase C). The other 12 workspaces show `<NONEXISTENT>` in `--dry-run`
  output and are simply ignored. No need to filter; turbo handles it.

- **Killing `turbo run dev:portf` externally (e.g., `kill <pid>`) does
  not propagate SIGTERM to child node processes — they leak the bound
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
  is runnable. No defensive change in Phase A — adding a `.gitkeep`
  wouldn't help (still no `.yaml` match) and pre-creating an empty seed
  file would be off-scope for plumbing.

## Phase B — portf seeds + matcher smoke (landed 2026-05-26)

- **The portf default locale is `'en'` end-to-end — seed CLI stamps it,
  matcher requires it in the request `locales`.** `pnpm seed:portf`'s
  root script ships `--locale=en`, which makes every seeded row's
  `pairs.locale='en'`. The matcher cascade filters
  `(locale = $1 OR locale = 'und')` per pass, so a request with default
  `locales=['und']` is **invisible** to `en`-only rows. Production
  `apps/portf` will send `locales=['en','und']` (per spec §4.3); ad-hoc
  curl smoke against `:3010/chat` MUST include the same. Do not "fix"
  this by seeding `--locale=und` — that would defeat the per-locale
  cascade that Phase 11.1 designed for.

- **`/chat` on a miss emits `no_match` as an SSE event, NOT fallback
  text tokens.** `chat-handler.ts:144-152` writes the `unanswered` row
  and emits `{type:'no_match'}`. The FE renders the locale-appropriate
  fallback from its own i18n dict — server stays out of UX chrome so the
  user can switch locales without a roundtrip. Smoke assertions against
  `/chat` should check for the `no_match` event in the SSE frames; do
  NOT grep for the literal `"hmm idk, tell me more?"` fallback string
  — it will never appear in the stream. (The `app_config.fallback_message_*`
  rows still exist for `apps/portf` and `apps/web` to read via a
  different endpoint should it ever want server-canonical strings.)

- **`pairs.locale` per row is the CLI flag, not the YAML field.** The
  seed CLI's `Pair` type at `packages/db/src/scripts/seed.ts:11` is
  `{ input, response, topic? }` — `locale` is read from the
  `--locale=<tag>` arg and stamped uniformly across the run's rows. The
  spec §9 example showing `locale: en` inside a YAML row is illustrative
  only; the loader silently discards it. Future seed files in
  `seeds/portf/` should NOT include `locale:` per row — adding it
  misleads readers into thinking per-row locale tagging works without
  the CLI flag.

- **The Phase A wrap-up note "`fallback_message_en` not present on
  portf" was incorrect.** Migration 010 (lines 28–32) unconditionally
  inserts all three `fallback_message_{und,vi,en}` rows on every fresh
  DB — `pnpm migrate:portf` ran 010 against portf, so the rows are
  present. No additional migration or seed step is needed for fallback
  text. Verifying observations against `psql` before adding work is
  cheap; do it before introducing migrations to "fix" a non-bug. (This
  one cost only a planning question, not actual code — but it's a
  reusable pattern.)

- **Phase B is intentionally data-only — zero app source changes.** No
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
  lands, it will not be via a migration — `ON CONFLICT DO UPDATE`
  would stomp the simlm-side value, violating migration discipline.
  The chosen path is a per-DB one-shot SQL or a CLI script invoked
  only against the portf URL.

## Phase C — apps/portf scaffold (landed 2026-05-26)

- **Portfolio design source lives at `docs/superpowers/artifacts/simlm2/` and is operator-owned.**
  The full portfolio CSS + Wordmark variants live in `docs/superpowers/artifacts/simlm2/project/styles.css`
  and `docs/superpowers/artifacts/simlm2/project/primitives.jsx`. The parent
  path `docs/superpowers/*` is already gitignored, so the design source rides
  along for free — no extra `.gitignore` entry needed. Both files are read by
  `apps/portf` build-time ports (Task 5 + Task 6 of the Phase C plan). If a
  contributor's worktree is missing the artifact, the operator restores it
  from their design tarball — do NOT attempt to reconstruct it from
  `apps/portf`'s ported CSS alone, since Phase C ports only the blockcursor
  Wordmark variant; the other four are gone from `apps/portf` source but
  still live under the artifact path.

- **Phase C ships portfolio CSS as one monolithic `apps/portf/src/styles/portfolio.css`,
  not the spec §4.1 `theme.css` + `components.css` split.** The design source
  interleaves per-theme element overrides with base theme rulesets and with the
  generic component classes — splitting cleanly without dropping rules is risky
  and gains nothing for a phase whose only render target is a blank `/`. If
  Phase D+ needs to load only one half of the CSS (e.g., for a documentation
  page that wants the components but not the theme tokens), revisit the split
  with a real consumer driving the requirement.

- **`apps/portf/src/styles/portfolio.css` is in `.oxfmtignore` to preserve the
  byte-identical verbatim copy from the design source.** Task 5 used `cp` from
  the artifact and verified identity via `cmp`. Without the `.oxfmtignore`
  entry, `pnpm format` rewrites whitespace and breaks the guarantee
  (discovered during Task 8 — a 1721-line normalization diff). The rule is:
  any file in `apps/portf` ported verbatim from a third-party or design
  source goes into `.oxfmtignore` alongside the cp/copy commit. Internal
  portf source files (Wordmark.tsx, AppShell.tsx, etc.) are format-managed
  as usual.

- **TanStack Router has no `__404.tsx` convention.** Spec §4.1's `__404.tsx`
  entry was illustrative; the actual TanStack idiom is `notFoundComponent` on a
  parent route (root, in this case). The Phase C plan uses `notFoundComponent`
  on `__root.tsx`. If 404 logic ever needs its own loader/search params, switch
  to a splat route `src/routes/$.tsx`.

- **`data-theme="press"` is set on `<html>` by `apps/portf/index.html`,
  not by React.** The shell never unmounts (per spec §5.1), so a static HTML
  attribute is the cleanest writer — no risk of two React effects fighting over
  the value, no flash during first render. A future theme switcher (post-MVP)
  would call `document.documentElement.setAttribute('data-theme', x)` directly
  and persist via the preferences store; the index.html attribute stays as the
  v1 default.

- **`apps/portf` and `apps/admin` both want port 5174.** Spec §3's note covers
  this: run one at a time in dev. The `apps/portf` plan does not modify
  `apps/admin/vite.config.ts`. If the operator routinely wants both live at
  once, change `apps/admin`'s default port to 5175 in a separate
  Phase A-style plumbing follow-up; do not bake the workaround into
  per-developer env vars.

- **`apps/portf/src/routeTree.gen.ts` is gitignored AND tsconfig-included.**
  One entry in root `.gitignore` (the gen file) — the design source rides on
  the pre-existing `docs/superpowers/*` rule — plus the explicit
  `include` entry in `apps/portf/tsconfig.json`. TanStack regenerates it on
  vite dev/build; if a contributor sees a "cannot find module
  './routeTree.gen'" error from tsc, run `pnpm --filter @portf/web build` once
  to regenerate. The `build` script's `tsc --noEmit && vite build` order means
  the FIRST build on a fresh checkout fails on tsc — run `pnpm --filter
  @portf/web dev` briefly to trigger generation, then re-run build.

- **`TanStackRouterVite` must come before `react()` in the vite plugins array.**
  The router plugin writes the generated tree which the React/SWC plugin then
  transforms. Reversing the order makes the React plugin see stale or missing
  generated output on the first vite run.

- **`apps/portf` does not import `@simlm/ui-tokens`.** Per spec §2 the
  portfolio's design system is app-local (`apps/portf/src/styles/portfolio.css`).
  `@simlm/ui-tokens` is simlm's warm-neutral palette and would conflict with
  the press theme tokens. Keep them separate even if duplication of common
  primitives (radii, etc.) appears later — extracting a shared lower-level
  primitive layer is its own future RFC, not a side-effect of feature work.
