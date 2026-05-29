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

## I2 — Root layout
