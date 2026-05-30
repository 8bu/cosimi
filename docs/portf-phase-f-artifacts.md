# Phase F — MDX artifact catalog + matchArtifact + ArtifactPreviewCard (landed 2026-05-28)

Per-phase discovery log. Discipline rules learned during implementation that
should eventually fold into the root `CLAUDE.md`. One entry per non-obvious
rule: lead with the rule, then the rationale with concrete file paths, then
call out the trap that would break it.

- **`@mdx-js/rollup` plugin order in `apps/portf/vite.config.ts`:
  TanStackRouterVite -> mdx -> react -> tailwindcss.** TSR writes
  `routeTree.gen.ts` which downstream React/SWC consumes; mdx compiles `.mdx`
  -> JSX which the React plugin transforms. Reversing mdx <-> react makes the
  React plugin see raw MDX syntax and fail at build. The MDX plugin uses
  default `enforce`. Phase F's `apps/portf/src/routes/*.tsx` files do not
  import `.mdx`, so a TSR <-> mdx swap would silently work today — Phase G
  will likely add such an import, so the discipline applies preemptively.

- **`remark-mdx-frontmatter` exposes the YAML block as the named ESM export
  `frontmatter`, not `meta` or `attributes`.** The
  `{ name: "frontmatter" }` option in `vite.config.ts` is canonical;
  matching it on the consumer side in `apps/portf/src/features/artifacts/catalog.ts`
  (the `MdxModule.frontmatter` field) is load-bearing. If you rename it in
  one place, rename in both.

- **`vitest.config.ts` MUST mirror the production `vite.config.ts` MDX
  plugin chain.** `apps/portf/src/features/artifacts/catalog.ts` uses
  `import.meta.glob('../../artifacts/**/*.mdx', { eager: true })`. Eager
  globs are statically transformed at module load — the moment any test
  imports `@/features/artifacts/catalog`, every `.mdx` file under
  `apps/portf/src/artifacts/**` (including `__fixtures__/`) compiles. If
  the vitest config only loads `react()`, the SWC transform chokes on raw
  MDX syntax and tests cannot run at all. Discovered during Task 4 subagent
  dispatch; vitest config was updated in the same commit as the catalog.

- **The catalog's `_buildCatalog(modules, options)` is a pure builder that
  accepts a synthetic module record so `matchArtifact` and component tests
  never need MDX compilation.** Production wires `import.meta.glob` once
  and freezes the singleton via lazy `ensureCatalog()`; tests call
  `_setCatalogForTesting(catalog)` (test-only export) to swap. Never mock
  the whole module — the helper boundary is cleaner and keeps the test
  surface honest.

- **Catalog loader is fail-loud at module init.** Duplicate slugs,
  kind-mismatch, and valibot frontmatter validation failures all throw on
  the first call to `getCatalog()` / `getDescriptor()`. The first thrown
  error during render is fatal to the app, which is intentional — the
  operator sees the error immediately during dev, not a silent missing
  card in production. The thrown-Error pattern is the codebase's
  "constraint that should never fire in steady state" convention.

- **`Frontmatter.matchPatterns` schema enforces `v.minLength(2)` per
  pattern.** Subagent for Task 4 had to adjust the plan's literal test
  values from `["x"]` to `["xx"]` because single-char patterns fail
  valibot before reaching the test assertion. The schema is in
  `apps/portf/src/features/artifacts/types.ts` (D2 spec decision). Any
  future operator writing real-corpus MDX needs to keep this in mind —
  `matchPatterns: [b2b travel]` (1-word, 7 chars) is fine;
  `matchPatterns: [b]` is rejected at load.

- **`matchArtifact` runs in `messages-store.finishBot` ONLY when
  `status === 'settled'`.** Error settles do not surface an artifact card.
  Static-imported from `@/features/artifacts/match` at top of
  `apps/portf/src/store/messages.ts` — no dynamic import (matcher is sync
  and tiny; lazy load buys nothing on ~10 artifacts).

- **`BotMessage.artifactSlug: string | null` is REQUIRED, not optional.**
  Persisted v1 (Phase E) blobs lack the field; `hydrate()` normalizes on
  load by walking `byThread[*]` and setting `m.artifactSlug = null` on
  every bot message where the field is `undefined`. No disk-shape version
  wrapper. The renderer reads the field as `string | null` everywhere.
  Existing test fixtures across `MessageBubble.test.tsx` and
  `MessageList.test.tsx` had to be updated to include `artifactSlug: null`
  — typecheck catches missing fields on `ChatMessage`-typed literals.

- **`MessageBubble` reads the descriptor via `getDescriptor(slug)` at
  RENDER time, not at settle time.** The slug-only-on-message persistence
  shape means a rehydrated thread re-resolves the descriptor against the
  current catalog. If the operator deletes or renames an MDX file, stale
  slugs in persisted threads silently render no card (graceful
  degradation). DO NOT cache the descriptor on the message blob — that
  defeats the catalog-as-source-of-truth contract.

- **React 19 + `jsx: "react-jsx"` removes the global `JSX` namespace.**
  Explicit `: JSX.Element` return types on function components fail
  typecheck. Workspace convention in `apps/portf` is no explicit return
  type on FCs (`Sidebar`, `NewChatButton`, `ThreadRow` etc. all omit it).
  Plan literal had `: JSX.Element` per older React idioms; subagent for
  Task 7 dropped it to match React 19 + the existing convention.
  Behavior identical.

- **Em-dash -> hyphen; en-dash kept for date ranges only.** MDX
  frontmatter `period: '2022–2026'` uses en-dash (U+2013). Body prose
  and `summary` may NOT use em-dash (U+2014). The loader does NOT
  auto-convert — operator/author discipline. `apps/portf/src/artifacts/projects/wegopro.mdx`
  is the canonical example.

- **`apps/portf/src/artifacts/__fixtures__/` is filtered out of the
  production catalog at runtime, NOT at glob time.** The
  `excludeFixtures: true` option in `_buildCatalog` checks the path
  substring `/__fixtures__/` and skips. The `.mdx` files ARE still
  compiled and bundled — they just don't register as descriptors. This is
  fine for v1 (small fixtures, tiny bundle impact) but Phase G may want
  to add a Vite plugin-level glob exclude to skip compilation entirely.

- **`valibot` is now a runtime dep of `apps/portf`.** It was already in
  the workspace via `@cosimi/config` (root). Phase F adds it as a direct
  dep of `apps/portf` (`^1.0.0` resolves to 1.4.0; 1.4.1 was inside the
  7-day embargo on 2026-05-28). Used only for frontmatter validation in
  the catalog loader. Caret range; LTS-stable v1.
