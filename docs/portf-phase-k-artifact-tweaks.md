# Phase K — Artifact tweaks (discovery log, appended K1-K7)

Per-phase discovery log. Discipline rules learned during implementation.
One entry per non-obvious rule. Format: lead with the rule, rationale +
file paths, the trap that would break it.

## K1 — Gap analysis vs design source

### Visual deltas

- ArtifactPanel kicker: renders `{kicker}` verbatim; design source prefixes a `↗ ` glyph (`ARTIFACT · WEGOPRO …` -> `↗ ARTIFACT · WEGOPRO …`). `apps/portf/src/features/artifacts/components/ArtifactPanel.tsx:65` vs `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:285`.
- Panel title font-size: 22px in current CSS; design source inline-styles 24px. `apps/portf/src/styles/layout.css:475` vs `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:294`.
- Panel body padding: `14px 18px 24px` current; design source `16px 18px` (no extra bottom). `apps/portf/src/styles/layout.css:489` vs `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:291`.
- ProjectBody is bare-bones: renders only the stack header + `<Component />`. Design source has live-preview placeholder + a 2-up thumbnail grid + a paragraph + a footer row (`stack · ↗ url`) pinned to bottom with `margin-top: auto`. `apps/portf/src/features/artifacts/components/bodies/ProjectBody.tsx:7-21` vs `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:340-362`.
- CvBody is single-column; design source uses a `display: grid; grid-template-columns: 2fr 1fr; gap: 16px` two-column layout (experience+projects on the left, stack/AI workflow/education/languages on the right). `apps/portf/src/features/artifacts/components/bodies/CvBody.tsx:7-21` vs `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:531`.
- EssayBody renders only stack header + `<Component />`. Design source adds a footer row with `border-top: 1px solid var(--line)` containing left kbd (`Posts archive · in progress`) and right coral mono CTA (`↗ subscribe via RSS`). `apps/portf/src/features/artifacts/components/bodies/EssayBody.tsx:7-21` vs `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:457-463`.
- Inline preview card: `border: 2px solid var(--ink)` matches design. Thumbnail fallback path uses uppercased mono 9px / `--ink-4` chip; not exercised in current callsites — verify when ProjectBody re-render lands. `apps/portf/src/styles/layout.css:344-385`.
- Per-kind body typography (existing): essays first-letter drop-cap (56px coral display) at `apps/portf/src/styles/layout.css:510-518` already mirrors `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:436-449`. CV `is-resume` reduces base font to 11px (`layout.css:519-521`); design source uses 10.5px (`flow-and-pages.jsx:531`).
- CvAction button label is `↓ .PDF` (matches `flow-and-pages.jsx:528`) but currently anchors against `descriptor.url` and skips rendering when missing — design source unconditionally shows the button. `apps/portf/src/features/artifacts/components/actions/CvAction.tsx:7-14`.

### MDX descriptor inventory

| Kind | Slug | Status | Source |
|---|---|---|---|
| projects | wegopro | exists; body dummy | resume PDF p.2 + projects-deep.yaml |
| projects | multiplier-finance | NEW | resume PDF p.2 (BlockDevs era) |
| projects | superlauncher | NEW | resume PDF p.2 (Feb 2020 - Jan 2022) |
| essays | nuxt-migration | NEW | projects-deep.yaml `portfolio/migration-nuxt` |
| essays | simlm-design | NEW | projects-deep.yaml `portfolio/simlm` + CLAUDE.md |
| essays | vue3-web-components-bridge | NEW | nuxt-migration subset |
| misc | simlm-explainer | NEW | projects-deep.yaml `portfolio/simlm` |
| misc | tools-ai-workflow | NEW | stack.yaml + identity.yaml AI rows |
| misc | contact-coffee-chat | NEW | resume PDF header (email/github/linkedin) |
| resume | longnguyen-2026 | exists; needs CvSection wrap | resume PDF |

### SSG-readiness baseline (Phase I blockers)

- `apps/portf/src/features/artifacts/hooks/useCloseArtifact.ts:17`: `window.history.length`. Safe: yes. Reads inside `close()` callback returned by the hook — only fires from user click/Esc, never at module init or first render.
- `apps/portf/src/features/artifacts/components/ArtifactPanel.tsx:31`: `document.activeElement`. Safe: yes. Inside the `onKeyDown` handler attached to the section, never invoked during render.
- `apps/portf/src/features/artifacts/catalog.ts:93`: `import.meta.glob<MdxModule>("../../artifacts/**/*.mdx", { eager: true })`. Safe: yes. Vite resolves the glob at build time; `ensureCatalog()` runs on first call (lazy) but the modules object is statically materialized, so SSG render of `getCatalog()` / `matchArtifact()` does not touch runtime globals.
- `localStorage` / `sessionStorage`: no hits under `apps/portf/src/features/artifacts/**` or `apps/portf/src/components/**`. Safe: yes.

No module-init `window` / `document` reads in the artifact stack. K-phase work is free to ship new bodies / actions provided new code keeps DOM reads inside effects + handlers.

## K2-K7 entries land here

## K6 - SSG-readiness final guard

Baseline (K1): 0 module-init blockers found. K1 catalogued three runtime patterns (`useCloseArtifact` window.history read, `ArtifactPanel` document.activeElement read, `catalog.ts` import.meta.glob) — all classified SAFE because they sit inside callbacks / handlers / build-time-resolved globs.

After K2-K5 code work + K-CONTENT MDX authoring, the audit was re-run. New runtime patterns introduced:

| File | Line | Pattern | Context | SSR-safe? | Reason |
|---|---|---|---|---|---|
| hooks/useArtifactScrollRestore.ts | 23 | sessionStorage.getItem | useEffect body | yes | runs only on client after hydration |
| hooks/useArtifactScrollRestore.ts | 29 | sessionStorage.setItem | onScroll handler inside useEffect | yes | event handler, never SSR |
| hooks/useOpenerFocusRestore.ts | 16 | document.activeElement | useEffect body | yes | runs only on client after hydration |
| hooks/useOpenerFocusRestore.ts | 17 | document.body | useEffect body | yes | runs only on client after hydration |
| hooks/useCloseArtifact.ts | 21 | window.history.length | close() callback | yes | event handler, never SSR (K1 baseline pattern, unchanged) |
| components/ArtifactPanel.tsx | 32 | sectionRef.current?.focus | useEffect body | yes | runs only on client after hydration |
| components/ArtifactPanel.tsx | 37 | document.activeElement | onKeyDown handler | yes | event handler, never SSR (K1 baseline pattern, line shifted) |
| catalog.ts | 94 | import.meta.glob (eager) | inside ensureCatalog(), lazy | yes | Vite resolves at build time, not at runtime (K1 baseline pattern, line shifted) |

**Result:** No new module-init DOM reads. No client-only dynamic imports in the artifact stack. Phase I (Vike SSG) can prerender the standalone `/artifact/$kind/$slug` routes as-is.

K-CONTENT added 10 MDX descriptors but no runtime code; SSG audit unaffected.

## K7 - Gates + smoke

### Standing gates

- typecheck: pass (all 11 workspaces)
- lint: pass (8 warnings, 0 errors)
- format:check: pass (389 files, no drift)
- tests: 492/492 passing across 9 packages (matcher 17, web 33, template 14, normalizer 8, db 2, admin 103, api 53, admin-api 44, portf 218)
- build: pass (`@portf/web` -> dist, 369 kB JS / 58 kB CSS gzipped 116 / 11)

### Visual smoke matrix

| Kind | Slug | Desktop | Mobile |
|---|---|---|---|
| projects | wegopro | ok (kicker WEGOPRO.COM, × close, chrome top-left chips visible) | ok (← BACK pill left, × hidden, kicker right) |
| projects | multiplier-finance | ok (kicker MULTIPLIER.FINANCE, different content set) | n/a |
| essays | nuxt-migration | ok (drop-cap T, SUBSCRIBE VIA RSS kicker, essay typography) | ok (drop-cap survives narrow viewport) |
| resume | longnguyen-2026 | ok (2fr/1fr grid: EXPERIENCE + SELECTED PROJECTS left, STACK/AI WORKFLOW/EDUCATION/LANGUAGES right) | ok (single-column collapse, sections stack in correct order) |
| misc | simlm-explainer | ok (clean misc body, ABOUT THIS CHAT kicker, no .com action) | n/a |

Screenshots: `docs/portf-phase-k-smoke/`.

### Behavior verifications

1. open via inline preview card: pass ("🚀 Best project" chip -> bot reply with `Open artifact: WegoPro` button -> click opens split-pane, URL gains `?artifact=wegopro`)
2. close via ×: pass (URL drops `?artifact=...`, pane unmounts)
3. close via Esc (no manual tab): pass (re-opened wegopro, pressed Esc immediately, URL stripped — confirms pane auto-focused on mount)
4. close via ← BACK mobile: pass (at 375x812 the × is hidden and ← BACK pill closes the pane back to /chat)
5. scroll restore: pass (essay pane scrolled to 226 — clamped from 300 because viewport-limited body had max scroll of 226 — closed, reopened same slug, scrollTop restored to 226)
6. XL viewport 50/50 split: pass (at 1800 wide: sidebar 240 + chat 778 + artifact 778; 778 == 778, equal split confirmed)

### Issues found during smoke

None. All five direct-link MDX routes render with correct per-kind chrome (kicker / actions / chips). All six interactive behaviors pass on the chat shell. Drop-cap, 2fr/1fr resume grid, mobile single-column collapse, mobile ← BACK pill, kicker visibility, ×-vs-← mutual exclusion at the 600px breakpoint all match design intent. No CSS regressions, no layout overflow, no console errors observed during smoke.

Note on test env: the portf api on :3010 was running but the portf database had been provisioned away in a prior session; provisioned + migrated + seeded (327 active pairs across 10 batches) to make chat-driven behavior smoke executable. Not a code issue — the dev script (`scripts/dev-portf.sh`) handles this chain automatically for fresh starts.

## K-extension: artifacts gallery page

Per operator hand-off (chat transcripts `docs/superpowers/artifacts/simlm2/chats/`), the gallery shipped:

- new `/artifacts` route with sidebar + `<ArtifactsGallery />`
- sidebar item "Artifacts" with item count, above thread list, below `+ NEW CHAT`
- 4 filter pills: All / Projects / Writing / CV (matching design source; `misc` kind not surfaced on index)
- catalog-driven: 3 projects + 3 essays + 1 resume = 7 items shown
- CSS port from design source `styles.css:1525-1885` (sidebar nav-item icon + full `.artx-*` block)

### CSS variable substitutions

None required. All vars referenced by the design source's `.artx-*` rules (`--coral-tint`, `--cream-card`, `--line-strong`, `--label-tracking`, `--label-caps`) already exist in `portfolio.css` across every theme block (`cream`, `mono`, `riso`, `press` etc.) — verified via `grep -h '\-\-coral-tint\|\-\-cream-card\|\-\-line-strong'`. The port is therefore byte-faithful; no fallbacks added in `layout.css`.

### Layout deltas vs design source

- `.artifacts-shell` (new): mirrors `.chat-shell`'s `grid-template-columns: 240px 1fr` but anchored at `height: 100dvh` so the gallery fills the viewport when mounted outside `<ChatShell>` (which only wraps `/chat/*`).
- `.artx-body` and `.artx-single`: switched from `overflow: hidden` to `overflow-y: auto` so long content scrolls within the gallery card; the design source assumed a frame-clamped canvas.
- Mobile (`max-width: 768px`): `.artifacts-shell`, `.artx-body`, `.artx-card-grid`, `.artx-cv-detail-grid` all collapse to a single column. Sidebar drawer behavior is inherited from the existing `@media` block.

### Files added

- `apps/portf/src/features/artifacts-index/data.ts` — pure mapper from `getCatalog()` → gallery row shapes (`ProjectGalleryItem` etc.).
- `apps/portf/src/features/artifacts-index/components/ArtifactsGallery.tsx` — top-level component with local `useState<Filter>`.
- `apps/portf/src/features/artifacts-index/components/{ProjectRow,EssayRow,ProjectCard,EssayCard,CvSlab,CvDetail}.tsx` — row/card primitives, each ported from the matching component in `artifacts-page.jsx`.
- `apps/portf/src/features/artifacts-index/__tests__/ArtifactsGallery.test.tsx` — 6 tests covering header count, default All view, and All → Projects / Writing / CV pill switches plus href assertion. Boundary-mocks `@/features/artifacts-index/data` so MDX glob doesn't need wiring in jsdom.
- `apps/portf/src/features/sidebar/components/ArtifactsNavItem.tsx` — sidebar row at `/artifacts` with bordered mini-square icon (`.v1-nav-ico`) + zero-padded item count.
- `apps/portf/src/routes/artifacts.tsx` — TanStack file-based route mounting `.artifacts-shell` → `<Sidebar />` + `<ArtifactsGallery />`.

### Files modified

- `apps/portf/src/styles/layout.css` — appended the `.v1-nav-ico`, `.v1-nav-item`, `.artifacts-shell`, and full `.artx-*` block.
- `apps/portf/src/features/sidebar/components/Sidebar.tsx` — inserted `<ArtifactsNavItem />` between `<NewChatButton />` and `<ThreadList />`.
- `apps/portf/src/features/sidebar/__tests__/Sidebar.test.tsx` — added `useRouterState` to the router mock and stubbed `@/features/artifacts-index/data` so the new nav item renders under jsdom.

### CvDetail content provenance

The `EXPERIENCE` array hard-codes the company/role list from `apps/portf/public/longnguyen-2026.pdf` page 2 (WegoPro 2022-2026, BlockDevs/Multiplier 2019-2022, Motorist.sg 2017-2019, Letterink 2016-2017, Freelance 2013-2016). The standalone `/artifact/resume/longnguyen-2026` route still owns the full MDX résumé; this slab is a quick read on the CV filter view.

### Gates

- typecheck: pass (all workspaces)
- lint: pass (8 pre-existing warnings, 0 errors — none in new files)
- format:check: pass (400 files)
- tests: 224/224 passing in `@portf/web` (+6 vs Phase K's 218 baseline)
- build: pass (`@portf/web` -> dist, new `artifacts-Shvmtirm.js` 7.48 kB chunk, gzip 2.09 kB; CSS 64.99 kB gzip 12.28 kB)

