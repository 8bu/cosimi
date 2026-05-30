# Phase D — V2 HomePane (landed 2026-05-27)

- **TanStack Router `history.state` is typed via a single module
  augmentation file at `apps/portf/src/types/router.d.ts`.** Any new
  route that stashes typed state on the history extends the `HistoryState`
  interface there; do NOT cast `loc.state.<key>` at the call site. The
  file is picked up by tsc through the existing `"include": ["src"]`
  glob in `apps/portf/tsconfig.json` - no extra include entry needed.
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
  are async - flipping a state flag would let one more tick slip through
  before the loop checked it. Any future async UI sequence in `apps/portf`
  that needs interrupt semantics follows the same pattern: ref-based
  cancel flag, checked at every `await` boundary. Two more invariants:
  set the cancel flag BEFORE any setup, then `await Promise.resolve()`
  to let a prior in-flight run observe it; reset the flag only after
  that yield.

- **TanStack `beforeLoad` is the canonical redirect site, and `redirect`
  is a *thrown* sentinel - not a return value.** `return redirect(...)`
  type-checks but silently does nothing at runtime. Always `throw
  redirect(...)`. Bare `/chat` in `apps/portf/src/routes/chat.tsx`
  illustrates the pattern; reuse it for any future
  parent-route-with-default-child shape.

- **Phase D ships two zustand persist stores under `portf.*` keys**:
  `portf.preferences` (`primaryLocale`) and `portf.threads`
  (`{id, ts}[]` + `create()`). The naming convention is `portf.<store>`
  - do NOT reuse `simlm.*` keys (those belong to apps/web and could
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
  shim or re-export - `AppShell` is gone. The single consumer
  (`__root.tsx`) was updated in the same commit. A future contributor
  who greps for `AppShell` will find nothing; the rename is total.

- **`tailwind-merge` v3 bump is still deferred at the end of Phase D**
  because no portf code calls `cn()` yet. The first portf feature that
  needs to merge dynamic Tailwind utility classes triggers the bump -
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
  surviving more than one commit, that's a refactoring debt - bundle
  the dependent route into the same commit instead.
