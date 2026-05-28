# Phase G — ArtifactPane (landed 2026-05-28)

Per-phase discovery log. Discipline rules learned during implementation that
should eventually fold into the root `CLAUDE.md`. One entry per non-obvious
rule: lead with the rule, then the rationale with concrete file paths, then
call out the trap that would break it.

- **TanStack Router `validateSearch` propagates strict types to every
  caller targeting that route.** Adding
  `validateSearch: (s) => ({ artifact: typeof s.artifact === "string" ? s.artifact : undefined })`
  to `apps/portf/src/routes/chat.$threadId.tsx` made the search type
  `{ artifact?: string }`, which TanStack then required every
  `navigate({ to: "/chat/$threadId", ... })` and
  `redirect({ to: "/chat/$threadId", ... })` site to pass `search`
  explicitly (either `search: { artifact: undefined }` for a clean
  navigation, or `search: true` to keep current search). Phase G grew
  Task 9 from "edit one file" to "edit seven files" mechanically:
  `chat.tsx` (redirect), `Composer.tsx` (navigate), `NewChatButton.tsx`
  (navigate), `ThreadRow.tsx` (navigate), and the `ChatPaneRoute`
  navigate-effect inside `chat.$threadId.tsx` itself. **Future phases
  adding a `validateSearch` on any portf route must plan for type
  propagation across every call site.** Use `search: true` when the
  caller wants "keep current search" semantics; otherwise pass the
  explicit object.

- **`import.meta.glob` relative paths are file-position-sensitive — tests
  in `src/features/<x>/__tests__/` are THREE levels deep, not two.**
  `apps/portf/src/features/artifacts/catalog.ts` uses
  `import.meta.glob('../../artifacts/**/*.mdx', { eager: true })` and
  resolves correctly because `catalog.ts` is two levels below `src/`. The
  Phase G smoke test at
  `apps/portf/src/features/artifacts/__tests__/ArtifactPane.smoke.test.tsx`
  is three levels below `src/` (extra `__tests__/` segment), so its glob
  must be `'../../../artifacts/__fixtures__/projects/sample-project.mdx'`.
  Off-by-one returns an empty modules object and the catalog has no
  entries — silent failure. **Trap:** copy-pasting the catalog's glob
  into a test file always breaks. Verify the depth before copying.

- **Subagent commit-message discipline needs an explicit prompt rule —
  default subagent behavior adds `Co-Authored-By` trailers and bodies.**
  Phase G Task 2's first commit (`faa969c`) landed with a body and a
  `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer,
  violating the portf convention of single-line lowercase imperative
  subjects (Phase F precedent in `git log`). The fix in subsequent Task 3+
  dispatches: prompt the subagent with a multi-line block stating "Use
  `git commit -m \"<subject>\"` — single -m, single quoted string. NO
  `--message` with body, NO heredoc, NO `-m \"...\" -m \"...\"`" plus
  "After committing run `git log -1 --format='%B'` and confirm output is
  EXACTLY the single subject line." That fixed all 10 subsequent Phase G
  commits. **Rule:** every subagent dispatch that ends in a commit must
  include the explicit commit-message format rule AND the post-commit
  `git log -1 --format='%B'` verification step.

- **`useRef` is sometimes added defensively but never read; audit before
  shipping.** Phase G Task 2's first `ArtifactPanel.tsx` declared
  `const ref = useRef<HTMLElement>(null)` and bound `ref={ref}` on the
  section but never read `ref.current` — the Esc handler used
  `document.activeElement` directly. Caught by the code-quality review,
  fixed in `faa969c`. **Rule:** if a ref is unread, drop the import +
  declaration + binding. React 19 does not penalize unused refs at
  runtime but they confuse readers and trip stricter lint passes.

- **`<span role="button" tabIndex={0}>` requires an explicit Enter/Space
  `onKeyDown` handler — `<span>` is not natively activatable.**
  Phase G Task 2's first `ArtifactPanel.tsx` had `.artifact-back` and
  `.artifact-close` as spans with `role="button"` + `tabIndex={0}` +
  `onClick`, but no `onKeyDown`. Keyboard-only users tabbing to either
  span and pressing Enter/Space got nothing. Fixed in `faa969c` by
  adding a `handleKey` helper (Enter or Space → `onClose`) and binding
  it to both spans. **Pattern to follow:** see
  `apps/portf/src/features/artifacts/components/ArtifactPreviewCard.tsx`
  for the canonical handler shape. Alternative: use a native `<button>`
  instead of `<span role="button">` and get Enter/Space activation for
  free — but the portfolio.css class `.artifact-close` is shaped for
  span layout (not button), so converting requires CSS adjustments too.

- **The `misc` artifact kind has kicker text equal to the panel title
  (bare title in the kicker spec; verbatim in the panel-head title), so
  `screen.getByText("<title>")` matches twice and throws.** Phase G
  Task 6's misc-kicker test was originally written as
  `expect(screen.getByText("Thing")).toBeTruthy()` and failed because
  "Thing" appeared in both `.artifact-kicker` and `.artifact-panel-title`.
  The implementer adapted to
  `expect(container.querySelector(".artifact-kicker")?.textContent).toBe("Thing")`
  — semantically stronger than `getByText` (asserts the kicker
  specifically, not just "any element"). **Rule:** when descriptor data
  appears in multiple DOM locations (kicker + panel head), use
  `querySelector(class).textContent` instead of `getByText` to
  disambiguate. `getAllByText(...).length >= 1` is also acceptable.

- **`descriptor.summary` lives on `ArtifactPanel.meta`, NOT in the
  per-kind body header.** Original Phase G spec text had summary in both
  the panel meta AND the body's `<header.artifact-body-header>`. Self-
  review during plan-writing caught the duplication; resolved by routing
  summary exclusively to the panel chrome (single source of truth) and
  leaving the body header for the stack line only. **Trap:** any future
  contributor reading the design source's V3Artifact JSX (which has
  meta-as-caption + body prose) might re-introduce the duplication.
  Keep summary in panel.meta; bodies render stack-only preamble + the
  MDX Component.

- **Format drift accumulates across a phase; land a single
  `style(portf): apply oxfmt drift` commit at end-of-phase.** Tasks 2,
  4, 5, 6, 7, 9, 10 each individually passed `pnpm format:check` at
  commit time but their cumulative output drifted relative to the
  workspace formatter as inferred from neighboring files. Phase G's
  Task 12 (`pnpm format:check` re-run after CSS landed) flagged 10
  files. Resolution: scoped
  `pnpm exec oxfmt <file1> <file2> ...` on the 10 files + a single
  `style(portf): apply oxfmt drift` commit (`1ac8e06`). Same pattern
  appeared in Phase D (`7d72f0e style(portf): apply oxfmt format drift
  across phase d files`). **Rule:** treat format drift as expected
  Phase-end housekeeping; don't try to chase it commit-by-commit (would
  burn extra commits + risk amend-temptation).

- **TanStack Router `routeTree.gen.ts` regeneration in a CI-clean
  worktree needs a deliberate `dev` boot, not just `build`.** Phase G
  Task 8 added `apps/portf/src/routes/artifact.$kind.$slug.tsx`. The
  vite plugin regenerates `routeTree.gen.ts` (gitignored) on dev OR
  build, but a build-then-typecheck pipeline reads the stale tree
  before vite rewrites it. The reliable sequence:
  `pnpm --filter @portf/web dev` (kill after ~5 sec) → then
  `pnpm -r typecheck` → then `pnpm --filter @portf/web build`.
  Subagent dispatches that include the route-tree regen step
  explicitly avoid the "Cannot find module './routeTree.gen'" failure.

- **The standalone `/artifact/$kind/$slug` route emits as a separate
  build chunk** — verified during Task 8 (`dist/assets/artifact._kind._slug-r6xlNBVH.js`
  ~0.16 kB gzipped). Phase I (Vike SSG) will enumerate these chunks
  one-per-descriptor; the small chunk size confirms the route component
  is essentially a thin wrapper around `<ArtifactPane>` (which is in
  the shared bundle). **No action needed for G;** noting it for Phase I
  planning so the prerender expectation is "one HTML per descriptor +
  shared JS chunk", not "one HTML per descriptor + per-descriptor JS".

- **Single-DOM dual-viewport CSS swap is the right pattern; avoid JS
  width-sniffing for the desktop-vs-mobile artifact-pane mode.**
  `apps/portf/src/components/ChatShell.tsx` always renders the third
  grid column when an artifact is open; `layout.css`'s
  `@media (max-width: 768px)` block hides the chat/sidebar columns and
  promotes `.artifact-pane` to `position: fixed; inset: 0; z-index: 40`.
  The `.artifact-close` × button is hidden on mobile via CSS
  (`display: none`); the `.artifact-back` ← BACK pill is hidden on
  desktop. Same React tree, same DOM tree, CSS-only swap — saves a
  responsive-test file (jsdom can't validate media queries against
  viewport size) and matches Phase E's sidebar-drawer pattern. **Trap:**
  adding a `useViewport()` hook to conditionally render different
  children on mobile would split the test surface in half and require
  matchMedia mocking everywhere. Don't.
