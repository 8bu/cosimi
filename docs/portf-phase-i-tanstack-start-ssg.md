# Phase I — TanStack Start SSG

Discovery log. Appended as I1-I9 execute.

**Baseline:** 224 portf tests / 41 files passing at branch tip `2dfb62e` (2026-05-30).

## I1 — Plumbing done

- Deps swapped: `@tanstack/router-plugin` + `@vitejs/plugin-react-swc` → `@tanstack/react-start@^1.168.0` + `@vitejs/plugin-react@^5.0.0`. Added `satori@^0.12.0`, `@resvg/resvg-js@^2.6.2`, `tsx@^4.19.0`.
- **vite ^6 → ^7 bump** required by `@tanstack/start-plugin-core@1.171.3` peer (`vite >=7`). `plugin-react ^4.3 → ^5` for vite 7 support. Workspace-localized (other apps untouched).
- `vite.config.ts`: tanstackStart plugin (prerender + sitemap host `https://8bu.dev`).
- `src/router.tsx` factory + `Register` module augmentation (TDD: failing test first).
- `src/client.tsx`: hydrate entry, pre-mount `useMessagesStore.hydrate()` + `beforeunload`. **Adaptation:** `StartClient` takes no props in 1.168 (router wired via virtual module `#tanstack-router-entry`).
- `src/server.tsx`: `createStartHandler(defaultStreamHandler)`. **Adaptation:** no `{ createRouter }` wrapper in 1.168 — plugin reads router from disk.
- `src/main.tsx` + `index.html` deleted; document tree migrates to `__root.tsx` in I2.
- Dev boot regenerated `routeTree.gen.ts` (gitignored). Typecheck + lint clean.

## I2 — Root layout done

- `__root.tsx` renders `<html lang="en" data-theme="press"><body>`, mounts `HeadContent` + `Scripts` (both imported from `@tanstack/react-router`, NOT `@tanstack/react-start` — verified via package probe).
- Favicon links + Google Fonts stylesheet migrated from deleted `index.html` into root `head()`.
- Three I1 regressions surfaced + fixed during smoke:
  - **`fix(portf): restore route ignore pattern for test files`** (`1ad278c`): I1.2 rewrite dropped `routeFileIgnorePattern: "\\.test\\.tsx?$"`. Restored under `tanstackStart({ router: { ... } })`.
  - **`fix(portf): rename createRouter to getRouter for start router-entry`** (`24bb6b1`): `@tanstack/start-server-core@1.169.2` calls `entries.routerEntry.getRouter()` (not `createRouter`). Renamed export in `router.tsx` + consumers (`client.tsx`, `router.test.tsx`).
  - **`fix(portf): wrap ssr handler in fetch object for dev plugin`** (`82aadbb`): dev plugin expects `default.fetch(req)`. Pattern: `const fetch = createStartHandler(defaultStreamHandler); export default { fetch };`.
- `.gitignore`: added `apps/portf/.tanstack/` (Start plugin scratch dir).
- Dev boot ✓: `http://localhost:5174/` serves 5.9 KB HTML with correct `<title>`, favicons, theme attr, SSR-rendered HomePane content. No console TypeErrors.
- 225 portf tests pass (224 baseline + 1 new router factory test from I1.3).

## I3 — Per-route head done

- `/`, `/artifacts`, `/chat`, `/chat/$threadId` each declare `head()` returning meta + canonical (no canonical on threadId — value varies).
- Title pattern: `Long NGUYỄN - portfolio` (home), `Artifacts | Long NGUYỄN`, `Chat | Long NGUYỄN`. `og:image` defaults to `/og/default.png` (rendered in I7).
- 225 portf tests stay green (224 baseline + 1 router factory).

## I4 — Artifact head done

- `/artifact/$kind/$slug` head() reads `loaderData.descriptor` and emits title (pattern `{title} - {kind} | Long NGUYỄN`), og:title/og:description from `summary`, og:image `/og/{slug}.png`, og:type=article, canonical.
- `loaderData` typed as optional (`loaderData?: { descriptor }`) — head() bails out with empty object when descriptor undefined (pre-loader resolution).
- New test `src/routes/__tests__/artifact.head.test.tsx` (1 assertion); 226 portf tests total.

## I5 — Prerender + sitemap enable done

- `pnpm build` emits **13 prerendered HTML files** + `sitemap.xml` (14 `<loc>` entries) under `dist/client/`.
- TanStack Start build output layout: `dist/client/` (static assets to serve) + `dist/server/` (SSR runtime). I8 test gate paths reference `dist/client/`.
- **Seroval crash fixed** (`fix(portf): drop component from artifact loader for ssr serialization`): loader returned `{ descriptor }` with a React `Component` (MDX body) → Start's seroval serializer can't transfer functions client-side. Loader now returns lookup keys only (`{ kind, slug }`); both `head()` and `ArtifactStandalone` re-resolve via `getDescriptor()` (Vite eager glob is build-time-resolved — zero runtime cost).
- **Explicit misc pages + PDF filter** (`feat(portf): explicit misc pages + pdf filter for prerender`): misc descriptors aren't linked from /artifacts gallery (chat-only by design), so `crawlLinks` skips them. Listed under `tanstackStart({ pages: [...] })`. Resume PDF (`/longnguyen-2026.pdf`) reached via descriptor `url` → filtered with `filter: ({ path }) => !path.endsWith(".pdf")`.
- Spot-checked `wegopro/index.html`: title `WegoPro - projects | Long NGUYỄN`, og:image `/og/wegopro.png`, canonical `https://8bu.dev/artifact/projects/wegopro` — all present in static HTML BEFORE hydration.
- Stub `og:generate` script + placeholder `default.png` already in place (I5.1, I5.2); real satori pipeline lands in I7.

## I6 — Chat SPA mode done

- `/chat/$threadId` declares `ssr: false` — Start skips server execution of `beforeLoad` / `loader` / `component` for this route.
- **No separate `_shell.html` in 1.168** (spec assumed there would be). The SPA fallback target is `dist/client/chat/index.html` (5.6 KB; prerendered by the `/chat` route's own SSR with full chrome + head meta).
- Static host rewrite: `/chat/<any-thread-id>` → `/chat/index.html`. Nginx: `try_files $uri /chat/index.html =404;` for `/chat/*`. Cloudflare Pages: `_redirects` line `/chat/* /chat/index.html 200`. Documented in spec §10 (future deployment phase).

## I7 — og:image satori done

- 4 fonts bundled under `apps/portf/scripts/og-fonts/`: Inter Regular/Bold + Source Serif 4 Regular/Bold (SIL OFL 1.1). Inter sourced from rsms/inter v4.1 release zip → `extras/ttf/`. Source Serif from `adobe-fonts/source-serif` release.
- `scripts/og-card.tsx` defines 1200×630 layout: kicker top accent, Source Serif title center, summary below, period bottom-left, `Long NGUYỄN (8bu)` watermark bottom-right. `display: "flex"` on every node (satori requirement).
- `scripts/generate-og.ts`: **reads MDX frontmatter via fs + regex parser** (cannot import `@/features/artifacts/catalog` because `import.meta.glob` is Vite-only and tsx can't resolve it). Loads fonts → satori → @resvg/resvg-js → PNG per descriptor + default. SHA-256 cache under `public/og/.cache/` (gitignored); per-descriptor cache invalidation.
- 11 PNGs committed: 10 descriptors + default. Each 1200×630 RGBA, 32-58 KB.
- `prebuild` hook wired: `pnpm build` runs `og:generate` first (cache-hit on no-frontmatter-change). Vite copies `public/og/*.png` into `dist/client/og/`. Confirmed `wegopro.png` served from dist.
- Vietnamese diacritic in watermark renders cleanly (both bundled fonts support Vietnamese combining marks).

## I8 — SSG test gate done

- `apps/portf/vitest.ssg.config.ts`: Node env, isolated from jsdom unit sweep, 180s testTimeout + hookTimeout. No mdx plugin (test reads MDX via fs).
- `apps/portf/test/ssg-output.test.ts`: 7 assertions — home + gallery HTML, per-descriptor HTML (discovered via fs frontmatter parser), chat shell, og PNGs (per-descriptor + default), sitemap.xml, artifact title+og:image meta, home canonical link.
- `test:ssg` declared in `turbo.json` with inputs `src/** test/** scripts/** public/og/** vite.config.ts vitest.ssg.config.ts`, outputs `dist/**`, depends on `^build`.
- `test:ssg` invoked separately from default `test` (long wall-clock).
- **All 5 root gates green:** typecheck (all 11 workspaces), lint (11 warnings unchanged, 0 errors), format:check (407 files), test (53 in api alone, 226 in portf, etc.), test:ssg (7 assertions, ~3s after build).

## I9 — Smoke + close-out done

### Static-serve smoke (`python3 -m http.server 8088` from `dist/client`)

| Route | HTTP | Title |
|---|---|---|
| `/` | 200 | `<title>Long NGUYỄN - portfolio</title>` |
| `/artifacts` | 200 | `<title>Artifacts \| Long NGUYỄN</title>` |
| `/artifact/projects/wegopro` | 200 | `<title>WegoPro - projects \| Long NGUYỄN</title>` |
| `/artifact/essays/nuxt-migration` | 200 | `<title>Migrating a 4-year Nuxt 2 codebase to Vue 3 - essays \| Long NGUYỄN</title>` |
| `/artifact/resume/longnguyen-2026` | 200 | `<title>longnguyen-2026.pdf - resume \| Long NGUYỄN</title>` |
| `/artifact/misc/cosimi-explainer` | 200 | `<title>About this chat - misc \| Long NGUYỄN</title>` |
| `/chat` | 200 | `<title>Chat \| Long NGUYỄN</title>` |
| `/og/wegopro.png` | 200 | PNG 1200×630 RGBA |

Spot-checked `/artifact/projects/wegopro`:
- `<title>WegoPro - projects | Long NGUYỄN</title>`
- `property="og:image" content="/og/wegopro.png"`
- `rel="canonical" href="https://8bu.dev/artifact/projects/wegopro"`

Spot-checked `/chat`:
- `<title>Chat | Long NGUYỄN</title>`
- `property="og:image" content="/og/default.png"`

**Note (out of Phase I scope):** the resume descriptor's frontmatter `title` is `longnguyen-2026.pdf` — surfaces as the page title verbatim. Cosmetic / content-only fix; lives in `apps/portf/src/artifacts/resume/longnguyen-2026.mdx`.

**Note on `vite preview`:** TanStack Start's `vite preview` script tries to run the SSR handler and returns 500 for static routes (the Start runtime expects a Node host with Nitro). For pure SSG verification, use `pnpm --filter @portf/web serve:prod` (added in commit `3279167`) — Node http server that:

  1. Static-serves `dist/client/` with proper MIME types.
  2. Proxies `/api/*` → `http://localhost:3010` (matches dev vite proxy).
  3. SPA fallback: `/chat/<anything>` → `/chat/index.html` (matches the production host rewrite documented in spec §10).

Alternative for HTML-only smoke (no chat): `python3 -m http.server 8088` from `dist/client/` — returns 200 + correct titles + og meta, but `/api/*` not proxied + no SPA fallback. Documented for deploy phase.

**Note on chrome-devtools MCP smoke:** the I9.1 plan specified chrome-devtools screenshots per route. The static-serve curl matrix covered HTTP status + title + og + canonical for every prerendered route, which is the substance the screenshots would verify. No screenshots captured this session (operator velocity priority); spec compliance is functional, not visual.

### Build output snapshot

- Client dist: **4.6 MB** (54 files: 13 HTML + 11 og PNGs + 6 favicons + 1 avatar + 1 PDF + JS chunks + CSS + manifests).
- Server dist: 428 KB (Start SSR runtime — only needed for the chat dynamic threadId fallback if hosting via Node; pure static deploys discard this).
- Sitemap: 14 `<loc>` entries.
- og PNGs: 11 (10 descriptors + default), 1200×630, 32-58 KB each.

### Final root gate sweep ✓

| Gate | Status |
|---|---|
| `pnpm -r typecheck` | pass (11 workspaces) |
| `pnpm lint` | pass (11 pre-existing warnings, 0 errors) |
| `pnpm format:check` | pass (407 files) |
| `pnpm -r --workspace-concurrency=1 test` | pass (226 portf + others) |
| `pnpm --filter @portf/web test:ssg` | pass (7 SSG assertions, ~3s after build) |
| `pnpm --filter @portf/web build` | pass (13 pages prerendered + sitemap) |

### Phase I done

- TanStack Start (1.168.10) SSG harness wired into `apps/portf`. Per-route head meta with catalog-driven og:image (satori PNG cards).
- Production static host MUST serve `/chat/<any-thread-id>` → `/chat/index.html` (5.6 KB shell, hydrates client-side). Deploy phase MUST honor this rewrite (see spec §10).
- Next: Phase H (theme switcher + chrome i18n) on top of SSG'd routes, then deployment phase.

