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
