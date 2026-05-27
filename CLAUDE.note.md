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

- **`apps/portf`'s `build` script is `vite build` alone — typecheck is the
  separate `typecheck` task.** Combining them as `tsc --noEmit && vite build`
  (apps/web's pattern) breaks on a fresh clone because TanStack Router's
  `routeTree.gen.ts` is gitignored, written by the vite plugin, so tsc errors
  on the missing import before vite gets to run. CI runs `pnpm -r typecheck`
  and `pnpm -r build` as separate gates anyway, so the decoupling costs
  nothing and gains fresh-clone resilience.

## Phase D — V2 HomePane (landed 2026-05-27)

- **TanStack Router `history.state` is typed via a single module
  augmentation file at `apps/portf/src/types/router.d.ts`.** Any new
  route that stashes typed state on the history extends the `HistoryState`
  interface there; do NOT cast `loc.state.<key>` at the call site. The
  file is picked up by tsc through the existing `"include": ["src"]`
  glob in `apps/portf/tsconfig.json` — no extra include entry needed.
  Side note: the empty `export {}` marker at the end trips a single
  oxlint `unicorn(require-module-specifiers)` warning (1 warning, exit 0).
  Acceptable for v1; can be swapped for `import "@tanstack/react-router";`
  if the warning becomes load-bearing noise.

- **`apps/portf` uses native `crypto.randomUUID()` for thread IDs.**
  The CLAUDE.md rule against `crypto.randomUUID()` is specifically for
  apps/web *session* IDs (server-canonical, race conditions on
  split-brain). Thread IDs are client-only and a different concept.
  Portf will always run in an HTTPS or localhost context where
  WebCrypto is defined. Do not introduce `uuid` or `nanoid` as a dep.

- **`Composer.runChipAnimation()` uses a `cancelRef: { current: boolean }`
  cancel pattern, read between async ticks.** React `useState` updates
  are async — flipping a state flag would let one more tick slip through
  before the loop checked it. Any future async UI sequence in `apps/portf`
  that needs interrupt semantics follows the same pattern: ref-based
  cancel flag, checked at every `await` boundary. Two more invariants:
  set the cancel flag BEFORE any setup, then `await Promise.resolve()`
  to let a prior in-flight run observe it; reset the flag only after
  that yield.

- **TanStack `beforeLoad` is the canonical redirect site, and `redirect`
  is a *thrown* sentinel — not a return value.** `return redirect(...)`
  type-checks but silently does nothing at runtime. Always `throw
  redirect(...)`. Bare `/chat` in `apps/portf/src/routes/chat.tsx`
  illustrates the pattern; reuse it for any future
  parent-route-with-default-child shape.

- **Phase D ships two zustand persist stores under `portf.*` keys**:
  `portf.preferences` (`primaryLocale`) and `portf.threads`
  (`{id, ts}[]` + `create()`). The naming convention is `portf.<store>`
  — do NOT reuse `simlm.*` keys (those belong to apps/web and could
  silently collide on the same origin if both apps were ever served from
  the same host). Phase E grows `threads` with title/lastSnippet/pinned
  and adds rename/remove/touch/setTitle/revisit; the persisted shape
  bumps `version: 2` with a `migrate` callback when that lands.

- **zustand-store tests need `vi.resetModules()` in `beforeEach`** to
  defeat the module-singleton state that survives `localStorage.clear()`.
  Without it, `await import("../threads")` returns the cached singleton
  and threads accumulate across tests in the same file. This applies to
  any store whose tests assert on accumulated state. The preferences
  store doesn't need it because each test overwrites `primaryLocale` via
  the setter; the threads store does because `create()` prepends, and
  the Composer tests do for the same reason (each submit `create()`s).

- **React 18 + `vi.useFakeTimers()` requires `act()` wrappers when state
  updates fire from timer callbacks.** `HomePane.test.tsx`'s chip-click
  test wraps both `render(...)` and `fireEvent.click + advanceTimersByTimeAsync`
  in `await act(async () => { ... })` because React's concurrent scheduler
  uses `MessageChannel` (intercepted by fake timers), so post-timer state
  updates won't reach the DOM otherwise. The Composer tests don't need
  this because they call `runChipAnimation()` directly via the imperative
  handle, not through a React event chain.

- **Phase C's `AppShell` is renamed `PortfShell` (D rename).** Spec
  vocabulary uses `PortfShell` throughout §§5.1, 5.2, 10. There is no
  shim or re-export — `AppShell` is gone. The single consumer
  (`__root.tsx`) was updated in the same commit. A future contributor
  who greps for `AppShell` will find nothing; the rename is total.

- **`tailwind-merge` v3 bump is still deferred at the end of Phase D**
  because no portf code calls `cn()` yet. The first portf feature that
  needs to merge dynamic Tailwind utility classes triggers the bump —
  and the workaround at that point is NOT to import `cn()` from apps/web
  (cross-app dependency), it's to bump `tailwind-merge` to `^3.0.0` and
  add a local `apps/portf/src/lib/cn.ts` mirroring apps/web's shape.

- **HomePane layout is inline-styled, not `portfolio.css`-classed.**
  The wrapping `<main>` and the column-stacking flex are layout-only
  concerns; adding new classes to `portfolio.css` would break the
  verbatim-preservation guarantee (and the `.oxfmtignore` listing).
  When Phase E introduces shared layout containers (sidebar gutter, etc.),
  the right home for those classes is a new `apps/portf/src/styles/layout.css`
  (created in E), NOT an edit to `portfolio.css`. The two files import
  in order from `globals.css`; layout overrides any design tokens that
  collide.

- **Run `pnpm format:check` (not `pnpm format`) inside the per-task gate
  loop.** `pnpm format` writes; running it from a task subagent will
  fold unrelated formatter drift into the feature commit. If
  `format:check` flags drift mid-phase, land a separate `style(portf):
  apply oxfmt drift` commit and keep the feature commit clean.

- **Route `as any` casts forward-reference unregistered routes are
  short-lived.** Task 9's `Composer` navigated to `/chat/$threadId`
  before Task 13 created the route; an `as any` cast on the navigate
  options kept typecheck green. Task 13 (route stub) + the same commit
  removed the cast. If you find a similar forward-reference pattern
  surviving more than one commit, that's a refactoring debt — bundle
  the dependent route into the same commit instead.

## Phase E — V1 Chat + sidebar + threads (landed 2026-05-27)

- **`apps/portf` writes the per-thread messages blob with a hand-rolled
  debounced persist, NOT zustand's `persist` middleware.**
  `apps/portf/src/store/messages.ts` schedules a 200ms-debounced
  `localStorage.setItem('portf.messages', ...)` from token-accumulating
  actions (`appendBotToken`, `applyMetadata`, `applyNoMatch`) and flushes
  immediately on terminal transitions (`finishBot`, `clear`) and
  `beforeunload`. If a contributor swaps in `persist({...})` to
  "simplify," every streamed token will write to disk — measurable jank
  on long replies. The pattern is reusable for any future portf store
  with high-frequency state changes.

- **`apps/portf` chat streams run in the messages-store action, not in a
  route effect.** A module-level `Map<threadId, AbortController>`
  (`apps/portf/src/lib/inflight.ts`) holds per-thread cancellations;
  `window.beforeunload` calls `abortAllInflight()`. Switching threads
  mid-stream is NON-destructive — the stream keeps writing into
  `byThread[oldId]`. Returning to the thread later shows the settled
  reply. Any new chat-like surface in `apps/portf` follows this shape:
  stream lifecycle is data-shape-scoped (threadId), not view-scoped.

- **`apps/portf` uses per-thread server sessions** stored in
  `portf.sessions: Record<threadId, serverSessionId>`. First POST per
  thread sends no `X-Session-Id`; the response header is adopted into
  the store (`apps/portf/src/lib/streamChat.ts`); subsequent posts send
  the cached header. This preserves CLAUDE.md's server-canonical-session-id
  rule while giving each thread its own server-side session_teaches scope
  and rate-limit budget. Don't "consolidate" to one visitor session — it
  breaks the thread-isolation contract and surprises the server's
  per-session GC.

- **`threads.remove()` is a cross-store coordinator.** Removing a thread
  cascades into `sessionsStore.clear(id)` (synchronous static import) and
  `messagesStore.clear(id)` (dynamic import — keeps the messages store
  out of the threads-store module init graph). Any new portf store keyed
  by `threadId` MUST register a `clear(id)` action and be added to the
  cascade.

- **`apps/portf` has NO `/teach` plumbing and NO vote UI.** No
  `TEACH_PREFIX_RE` mirror, no `vote` field on the bot-message shape,
  no `teach_ack` UI surface (handled defensively as a no-op in the
  store's event reducer). If a visitor types literal `/teach …`, the
  server processes it normally and the bot bubble settles with empty
  text — accepted edge case. If a future phase ever enables /teach on
  portf, the parity surface is in `apps/web/src/features/chat/store.ts`
  (teach branch) and `apps/web/src/features/chat/tokens.ts` (regex).

- **`apps/portf/src/styles/layout.css` is the home for portf layout
  classes; `portfolio.css` stays verbatim.** Phase E's chat-shell grid,
  sidebar mobile drawer state (`.v1-sidebar.is-open`), backdrop,
  typing indicator (`.typing-indicator`), bubble `is-error` modifier,
  inline rename input, and thread-remove button styles all live in
  `layout.css`. The import order in `globals.css` is `portfolio.css`
  THEN `layout.css` — layout wins on selector tie. Adding new state
  classes MUST go to `layout.css`, never `portfolio.css`.

- **`apps/portf`'s `apiBase()` is a function, not a const.**
  `apps/portf/src/lib/apiBase.ts` returns
  `import.meta.env.VITE_PORTF_API_BASE ?? '/api'` on every call. Phase E
  doesn't ship a runtime switcher, but this matches the apps/admin
  runtime-config pattern (CLAUDE.md) so a future config UI can change
  behavior without a re-import. Don't refactor to
  `export const API_BASE = ...` — that snapshots at module init and
  breaks the future switcher.

- **The `consumedRef` pattern in `chat.$threadId.tsx`'s `initialPrompt`
  effect is the third use of the cancel-via-ref shape in `apps/portf`**
  (after Phase D's `Composer.runChipAnimation`'s `cancelRef`). React
  StrictMode double-mounts effects in development; state flags would
  let the second mount re-fire. Ref flag set synchronously inside the
  effect body, checked at the top — same shape every time. Any future
  async UI sequence with "do exactly once" semantics follows this
  pattern.

- **`apps/portf/package.json` adds `sonner ^1.7.0` in Phase E** (resolved
  to ^1.7.4 in workspace lock). Same caret range as `apps/web`. Already
  audited in `docs/dep-audit-2026-05-26.md`. Imported dynamically from
  the messages store's error paths (so unit tests don't need to mock it)
  and statically from `main.tsx` for the `<Toaster />` mount.

- **The messages-store `done` event handler is guarded against
  overwriting an `error` status.** A preceding `error` event sets
  `status: 'error'`; if a `done` event follows in the same stream
  (server emits both), naive handling would settle back to `'settled'`
  and lose the error indicator. The `case "done"` arm in
  `apps/portf/src/store/messages.ts` checks the current bot status
  and skips `finishBot('settled')` when it's already `'error'`. Any
  future event-reducer arm that calls `finishBot('settled')` must
  follow the same guard.

- **DO NOT pre-implement portf components from spec text — port the
  prebuilt JSX from `docs/superpowers/artifacts/simlm2/project/`.** The
  design artifact IS the source of truth: `primitives.jsx`
  (`UserBubble` / `AssistantBubble` / `InputRow` / `Chips` / `Wordmark`
  / `Anno`), `variations-1-2.jsx` (`V1Sidebar` / `V1Conversation` chat
  layout — Today/Earlier grouping, footer avatar, header title +
  status, chips-above-composer), `variations-3-4.jsx` (artifact pane
  shapes for Phase G), `styles.css` (verbatim-ported to
  `apps/portf/src/styles/portfolio.css`). Each component there is a
  complete JSX shape with the exact class-name structure that
  portfolio.css styles. The Phase E rev (2026-05-27 evening) had to
  redo MessageBubble, ChatComposer, Sidebar, ChatPane because the
  initial implementation invented its own shapes from spec text
  instead of porting these. The contract for any future portf phase:
  open the relevant artifact file, copy the JSX, then plug the data
  layer (props, store hooks, navigate, etc.) into the same nodes —
  DO NOT redesign the markup, DO NOT rename the classes, DO NOT
  rewrite from imagination. Only logic is freshly written; markup is
  ported. If the artifact and the spec disagree on shape, the
  artifact wins; if the artifact is missing, STOP and ask before
  inventing.

- **Subagents working in a git worktree MUST anchor cwd before any
  file write.** Phase E Task 5 (sessions store) created
  `apps/portf/src/store/__tests__/sessions.test.ts` in the MAIN
  worktree at `/Users/8bu/Projects/simlm/` instead of the active
  worktree at `/Users/8bu/Projects/simlm/.claude/worktrees/zazzy-
  munching-dragon/`. Cause: a Write tool call resolved against an
  ambient cwd that was not the intended worktree (subagent did not
  explicitly `cd` first OR a follow-up tool call lost the cd).
  Required guard for every subagent dispatch: the prompt must say
  `Work from: <absolute-worktree-path>` AND the subagent should run
  `cd "$(git rev-parse --show-toplevel)"` (or `pwd` to confirm) at
  the top of its session before any Write / Edit / Bash that
  creates files. Any task that creates a NEW file path should also
  verify the file lands under the expected worktree by reading it
  back from the absolute worktree path.
