# Phase C — apps/portf scaffold (landed 2026-05-26)

- **Portfolio design source lives at `docs/superpowers/artifacts/cosimi2/` and is operator-owned.**
  The full portfolio CSS + Wordmark variants live in `docs/superpowers/artifacts/cosimi2/project/styles.css`
  and `docs/superpowers/artifacts/cosimi2/project/primitives.jsx`. The parent
  path `docs/superpowers/*` is already gitignored, so the design source rides
  along for free - no extra `.gitignore` entry needed. Both files are read by
  `apps/portf` build-time ports (Task 5 + Task 6 of the Phase C plan). If a
  contributor's worktree is missing the artifact, the operator restores it
  from their design tarball - do NOT attempt to reconstruct it from
  `apps/portf`'s ported CSS alone, since Phase C ports only the blockcursor
  Wordmark variant; the other four are gone from `apps/portf` source but
  still live under the artifact path.

- **Phase C ships portfolio CSS as one monolithic `apps/portf/src/styles/portfolio.css`,
  not the spec §4.1 `theme.css` + `components.css` split.** The design source
  interleaves per-theme element overrides with base theme rulesets and with the
  generic component classes - splitting cleanly without dropping rules is risky
  and gains nothing for a phase whose only render target is a blank `/`. If
  Phase D+ needs to load only one half of the CSS (e.g., for a documentation
  page that wants the components but not the theme tokens), revisit the split
  with a real consumer driving the requirement.

- **`apps/portf/src/styles/portfolio.css` is in `.oxfmtignore` to preserve the
  byte-identical verbatim copy from the design source.** Task 5 used `cp` from
  the artifact and verified identity via `cmp`. Without the `.oxfmtignore`
  entry, `pnpm format` rewrites whitespace and breaks the guarantee
  (discovered during Task 8 - a 1721-line normalization diff). The rule is:
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
  attribute is the cleanest writer - no risk of two React effects fighting over
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
  One entry in root `.gitignore` (the gen file) - the design source rides on
  the pre-existing `docs/superpowers/*` rule - plus the explicit
  `include` entry in `apps/portf/tsconfig.json`. TanStack regenerates it on
  vite dev/build; if a contributor sees a "cannot find module
  './routeTree.gen'" error from tsc, run `pnpm --filter @portf/web build` once
  to regenerate. The `build` script's `tsc --noEmit && vite build` order means
  the FIRST build on a fresh checkout fails on tsc - run `pnpm --filter
  @portf/web dev` briefly to trigger generation, then re-run build.

- **`TanStackRouterVite` must come before `react()` in the vite plugins array.**
  The router plugin writes the generated tree which the React/SWC plugin then
  transforms. Reversing the order makes the React plugin see stale or missing
  generated output on the first vite run.

- **`apps/portf` does not import `@cosimi/ui-tokens`.** Per spec §2 the
  portfolio's design system is app-local (`apps/portf/src/styles/portfolio.css`).
  `@cosimi/ui-tokens` is cosimi's warm-neutral palette and would conflict with
  the press theme tokens. Keep them separate even if duplication of common
  primitives (radii, etc.) appears later - extracting a shared lower-level
  primitive layer is its own future RFC, not a side-effect of feature work.

- **`apps/portf`'s `build` script is `vite build` alone - typecheck is the
  separate `typecheck` task.** Combining them as `tsc --noEmit && vite build`
  (apps/web's pattern) breaks on a fresh clone because TanStack Router's
  `routeTree.gen.ts` is gitignored, written by the vite plugin, so tsc errors
  on the missing import before vite gets to run. CI runs `pnpm -r typecheck`
  and `pnpm -r build` as separate gates anyway, so the decoupling costs
  nothing and gains fresh-clone resilience.
