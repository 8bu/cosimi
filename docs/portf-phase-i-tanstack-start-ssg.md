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

## I3 — Per-route head meta
