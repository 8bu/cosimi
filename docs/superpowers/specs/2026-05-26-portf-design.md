# 8bu.dev portfolio (`apps/portf`) — design spec

**Status:** approved scope, pending phase-by-phase implementation review
**Author:** team (with Claude)
**Date:** 2026-05-26

## 1. Goal

Long Nguyen's personal portfolio at `8bu.dev`, built on the SimLM matcher engine. The portfolio **is** the chat: visitors land on a spotlight prompt, type or pick a chip, get an answer in a chat thread; rich-content topics (projects, writing, CV) open as artifacts in a right pane (desktop) or fullscreen view (mobile). No traditional pages, no top nav.

The design source bundled in `simlm2/` (read on 2026-05-26) locks the visual direction to theme **`press`** (#24 in the design's switcher: bright white + black + saturated red kicker, 2px borders, 0 radius, 700-weight serif display) and logo **`blockcursor`** (Silkscreen "8BU" badge with a blinking caret). The full 25-theme + 5-logo + 5-hover switcher ships in the UI tweaks panel; the user will pick the final default later. The chat-as-portfolio metaphor and the V2 → V1 → V3 flow are the locked product decisions; everything cosmetic is a runtime toggle.

## 2. Non-goals

- **No new backend code.** `apps/api`, `apps/admin-api`, `apps/admin` are reused verbatim. They're launched as a *second instance* per process pointed at the new `portf` database via env override — no source duplication, no clone-and-tweak.
- **No artifact_ref column on `pairs`.** Artifact opening is client-side first; the matcher protocol stays unchanged.
- **No teach feature** in the portfolio UI. Visitors cannot teach Long's portfolio. (The admin app — same admin reused for SimML — is the only write path.)
- **No multi-API for the same DB.** One `portf` database, one `apps/api` instance pointed at it. Same for admin-api.
- **No new shared packages** beyond what already exists. The press theme tokens live app-local in `apps/portf/src/styles/`, not in `@simlm/ui-tokens`.

## 3. Architecture

```
                                      ┌── apps/api      ──┐
                              :3000 ──│ DATABASE_URL=…simlm│── simlm
                                      └────────────────────┘  database
                                                                  ▲
                                      ┌── apps/api      ──┐       │
                              :3010 ──│ DATABASE_URL=…portf│── portf   ┐
                                      └────────────────────┘  database │ same
                                                                       │ PG
                                      ┌── apps/admin-api ──┐           │ container
                              :3001 ──│ DATABASE_URL=…simlm│── simlm   │
                                      └────────────────────┘           │
                                      ┌── apps/admin-api ──┐           │
                              :3011 ──│ DATABASE_URL=…portf│── portf   ┘
                                      └────────────────────┘
                                                                  ▲
                                                                  │
       ┌── apps/web   ──┐                                          │
:5173 ─│ → /api → :3000 │── simlm chat ──────────────────────────┐│
       └────────────────┘                                         ││
       ┌── apps/portf ──┐                                         ││
:5174 ─│ → /api → :3010 │── portf chat (fallback when client-side)││
       └────────────────┘                                         ││
       ┌── apps/admin ──┐                                          │
:5174* │ → /api → :3001 │── manages simlm OR portf via env ────────┘
       └────────────────┘   (single SPA, VITE_ADMIN_API switches target)

*Admin's dev port is 5174 — collides with portf. Bump apps/admin/vite.config.ts
 to keep its 5174 only when the operator launches simlm-side; the portf
 instance of admin (if needed) runs on 5176. In practice the operator
 launches one at a time.
```

### 3.1 Why two `apps/api` instances and not one DB-aware process?

`@simlm/config`'s `loadEnv()` reads a single `DATABASE_URL`. The api process is hard-wired to one DB at boot. Making it multi-tenant in-process means routing requests by host/header to one of two pools — a non-trivial change to the `apps/api` source for a single-operator dev scenario. Launching a second instance is one new `.env.portf` file + a per-app script and zero source changes. The cost is two Node processes in dev; both are <50MB, both already use `tsx watch`.

### 3.2 Why client-side artifact matching first?

The user explicitly requested it. Three concrete benefits:

- **Zero-latency artifact open** when the visitor's prompt obviously names a known project — no SSE roundtrip, no token streaming, just `setRoute('/artifact/project/wegopro')`.
- **No protocol change.** The matcher stays as-is; no new SSE event type, no migration, no shared-types update.
- **Authoring stays in one place.** Each `.mdx` artifact file carries its own `keywords:` frontmatter — adding a new artifact means adding one file, not editing a JS keyword map *and* writing content.

Trade-off: client-side keyword matching is shallower than Postgres FTS+trigram. To not strand visitors on near-miss queries, the client matcher's output funnels through three tiers identical in spirit to the matcher's:

| Tier | Trigger | Behavior |
|---|---|---|
| `direct` | One keyword hit, score ≥ 0.75 | Open artifact immediately. No `/chat` call. |
| `ambiguous` | 2+ artifacts above 0.40 | Fire `/chat` for the assistant reply AND render disambiguation chips: "Mean one of these? · 📁 WegoPro · 📁 Multiplier" |
| `miss` | No artifact above 0.40 | Normal `/chat` flow; matcher answers from `pairs`. |

Thresholds live in `apps/portf/src/lib/artifact-matcher.ts` as constants (not env) — they tune off real visitor input, not deploy config.

### 3.3 Artifact authoring: MDX with frontmatter

Each artifact is one file: `apps/portf/src/content/artifacts/<kind>/<slug>.mdx`. Example:

```mdx
---
kind: project
slug: wegopro
title: WegoPro
kicker: B2B travel & expense · 4 yrs · remote
keywords: [wegopro, b2b travel, travel and expense, t&e]
hero: ./hero.png
year: 2022
stack: [Vue 3, Nuxt, TypeScript, Pinia]
link: https://wegopro.com
---

import { Screenshots, StackTags } from '@/features/artifact/components/mdx'

# WegoPro

A B2B travel and expense platform serving Asia-Pacific enterprises. I joined
as the founding senior front-end engineer and shipped the booking UI…

<Screenshots images={['./shot-1.png', './shot-2.png']} />

## What I owned

…
```

Frontmatter parses via `gray-matter`; body compiles via `@mdx-js/rollup` (Vite plugin). All `.mdx` under `content/artifacts/**` are glob-imported at build into `artifactCatalog: Record<string, ArtifactModule>`. The catalog feeds both the matcher (frontmatter `keywords`) and the renderer (default export).

The MDX `components=` prop receives a tiny library of portfolio-specific components — `<Screenshots>`, `<StackTags>`, `<RoleChip>`, `<CVRoleRow>` — keeping markdown readable while letting visuals stay rich. These live in `apps/portf/src/features/artifact/components/mdx.tsx`.

## 4. Workspace plumbing

### 4.1 New directory: `apps/portf`

Mirrors `apps/web`'s scaffold:

```
apps/portf/
├─ package.json            # @portf/web — workspace name per user request
├─ index.html              # script + font preloads (Caveat, Fraunces, Inter, JetBrains Mono, Press Start 2P)
├─ vite.config.ts          # port 5174, proxy /api → http://localhost:3010 (portf api instance)
├─ tsconfig.json
├─ vitest.config.ts
├─ components.json         # shadcn config
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx              # Routes: /, /chat/:id?, /artifact/:kind/:slug, *
│  ├─ styles/
│  │  ├─ globals.css       # @import "tailwindcss"; @import "./theme.css"; @import "./components.css"
│  │  ├─ theme.css         # Tailwind v4 @theme block — base tokens; 25 [data-theme=...] overrides
│  │  └─ components.css    # .frame, .bubble, .chip, .input-row, .v1-*, .v2-*, .artifact-* — ported from design styles.css
│  ├─ components/
│  │  ├─ AppShell.tsx      # data-theme + data-logo + data-hover wrapper, Sonner toaster
│  │  ├─ Wordmark.tsx      # 5 logo variants, CSS-toggled by [data-logo]
│  │  ├─ DevTweaks.tsx     # development-only floating panel; theme + logo + hover + locale (gated by import.meta.env.DEV)
│  │  └─ ui/               # shadcn primitives copied (button, dialog, input, textarea, tabs, dropdown-menu, tooltip)
│  ├─ features/
│  │  ├─ home/             # V2 spotlight
│  │  ├─ chat/             # V1 sidebar + thread, mostly ported from apps/web/src/features/chat
│  │  └─ artifact/         # V3 pane + ProjectView / WritingView / CVView wrappers + MDX components + matcher
│  ├─ routes/              # Home, Chat, Artifact, NotFound — thin route shells
│  ├─ store/               # session.ts, preferences.ts, threads.ts, artifacts.ts
│  ├─ api/                 # client.ts (apiFetch/apiJson copied), chat.ts (streamChat copied), feedback.ts, health.ts
│  ├─ lib/
│  │  ├─ sse-parser.ts     # copied verbatim from apps/web
│  │  ├─ artifact-matcher.ts  # client-side keyword matcher
│  │  ├─ i18n/             # en.ts, vi.ts, index.ts — mirroring apps/web
│  │  └─ utils.ts
│  ├─ content/
│  │  └─ artifacts/
│  │     ├─ project/wegopro.mdx, multiplier.mdx, superlauncher.mdx, …
│  │     ├─ writing/post-mortem.mdx, …
│  │     └─ cv/index.mdx
│  └─ assets/
│     ├─ avatar.png        # from bundled uploads/2025_AVATAR.png
│     └─ LongNGUYEN_resume.2026.pdf  # downloadable
```

`@portf/web` (not `@simlm/portf`) per user choice — it's a separate product even though it shares packages.

### 4.2 Database: `portf` in existing PG container

Add `db/init/01_portf.sql` mounted into the postgres container via `docker-compose.dev.yml`:

```sql
SELECT 'CREATE DATABASE portf' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'portf')\gexec
```

`docker-compose.dev.yml` gains:

```yaml
volumes:
  - ./db/init:/docker-entrypoint-initdb.d:ro
```

Postgres' init-scripts only run on **first** container init (i.e., volume creation). `pnpm db:reset` already recreates the volume (`docker compose down -v && db:up`), so the init reliably re-runs after a reset. For incremental contributors who already have a SimML volume: a `pnpm db:provision-portf` one-shot script connects to the `postgres` maintenance DB and runs the `CREATE DATABASE` idempotently, so they don't have to nuke their simlm data.

Both databases share the same `@simlm/db` migrations. The migrate runner reads `DATABASE_URL` from env — so we call it twice with different URLs.

### 4.3 New `.env.portf` file

A second env file sits at repo root. Loaded via `tsx --env-file=...env.portf`:

```env
NODE_ENV=development
PORT=3010
ADMIN_PORT=3011
ADMIN_HOST=127.0.0.1
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/portf
LOG_LEVEL=info
# Match thresholds: portfolio replies should be more conservative —
# random near-misses on small corpus are worse here than a fallback.
MATCH_FTS_MIN=0.15
MATCH_TRGM_MIN=0.5
FALLBACK_MESSAGE=hmm, that one's not in my answer bank yet — try a chip, or DM me at hvanlong@pm.me
```

### 4.4 New root scripts

```jsonc
{
  "scripts": {
    // …existing simlm scripts unchanged…

    // portf — separate instances, separate db
    "dev:portf":       "turbo run dev:portf",                                                 // fan-out: every package that defines dev:portf runs it
    "migrate:portf":   "pnpm --filter @simlm/db exec tsx --env-file=../../.env.portf src/migrate.ts up",
    "seed:portf":      "tsx --env-file=.env.portf packages/db/src/scripts/seed.ts seeds/portf/*.yaml --locale=en",
    "provision:portf": "tsx scripts/provision-portf-db.ts"
  }
}
```

Turbo's `dev:portf` task fans out across every workspace that defines a `dev:portf` script:

```jsonc
// apps/api/package.json
"dev:portf": "tsx watch --env-file=../../.env.portf src/index.ts"

// apps/admin-api/package.json
"dev:portf": "tsx watch --env-file=../../.env.portf src/index.ts"

// apps/portf/package.json
"dev:portf": "vite"   // alias of dev; lets `pnpm dev:portf` boot all three with one turbo invocation
```

`turbo.json` needs a `dev:portf` task definition mirroring the existing `dev` task (`{"persistent": true, "cache": false}`). No source changes to `apps/api` or `apps/admin-api`. Running `pnpm dev:portf` boots all three processes in parallel; `Ctrl-C` tears them all down via turbo's signal propagation.

An umbrella `dev:all` that boots both products is deferred — process-count and port management gets noisy and the user already wants phase-by-phase visibility before adding more parallelism.

### 4.5 Admin reuse — switching DBs

`apps/admin` Vite proxy is fixed to `http://127.0.0.1:3001` (simlm admin-api). To manage portf, operator runs **the same admin SPA pointed at `:3011`** via a Vite env var:

```bash
VITE_ADMIN_API_TARGET=http://127.0.0.1:3011 pnpm --filter @simlm/admin dev
```

`apps/admin/vite.config.ts` is patched once to read `VITE_ADMIN_API_TARGET ?? 'http://127.0.0.1:3001'`. Both products' admin lives in one process at a time; operator switches sessions. (A future enhancement could ship a runtime DB-picker in the admin UI; out of scope here.)

## 5. Routes & client behavior

```
/                         V2 Home (spotlight)
                          - top bar: Wordmark + "● Open for senior roles · Q3 '26"
                          - center: big serif headline, sub line, InputRow, chips, mono try-suggestions

/chat                     → redirect /chat/<new-uuid>
/chat/:threadId           V1 Chat
                          - desktop: V1Sidebar (220px) + V1Conversation
                          - mobile: collapsed sidebar → ≡ burger; tap opens V1MobileMenu

/artifact/:kind/:slug     V3 Artifact (deep-linkable)
                          - desktop: chat (46%) + artifact (54%) split, like V3Desktop
                          - mobile: fullscreen artifact with ← BACK pill (artifact-back) returning to ?back= or /

*                         NotFound — single Wordmark + "404 · no thread here" + back-to-/ link
```

State (zustand stores):

- `session.ts` — `sessionId` + setter, persisted; copied from apps/web, reused.
- `preferences.ts` — `primaryLocale: 'en' | 'vi'` (default `'en'` for portfolio, opposite of SimML default), plus 4 new keys: `theme`, `logo`, `hover`, `devTweaksOpen`. All persisted to localStorage under `portf.preferences`.
- `threads.ts` — local-only thread list `{id, title, lastSnippet, ts}[]`, persisted. The portfolio has no server-side thread storage; the api's `sessions` table stores the SESSION but not the THREAD list. Each new `/chat/:id` creates a new thread row client-side.
- `artifacts.ts` — `currentArtifact: {kind, slug} | null` plus history stack for back navigation.

### 5.1 V2 → V1 transition

On V2, submitting the input row:

1. `matchArtifact(input)` runs synchronously against the in-memory catalog.
2. If `direct`: `navigate('/artifact/<kind>/<slug>')` — no `/chat` call.
3. If `ambiguous` or `miss`: create a new thread, navigate to `/chat/<newId>`, push the user message, fire `streamChat`. On `ambiguous`, also render the disambiguation chip row above the assistant bubble. The chips on click navigate to the matched artifact without firing a new `/chat`.

### 5.2 In-thread artifact opens

While in `/chat/:threadId`, the same `matchArtifact` runs on every submit. A direct hit:

- **Desktop**: triggers an inline `<ArtifactPane>` that overlays the right 54% of the viewport (`fixed` positioned, slides in from right). Chat stays interactive on the left. The pane's close `×` returns to the chat-only layout. The URL stays `/chat/:threadId?artifact=project/wegopro` so reloads restore the open pane.
- **Mobile**: navigates to `/artifact/<kind>/<slug>?back=/chat/<threadId>` — the fullscreen view, with ← BACK returning to the chat.

The `?artifact=` querystring approach (instead of a sub-route) keeps the chat-route stable; otherwise React Router would unmount the chat on open and lose typing state.

## 6. SSE protocol — no changes

`apps/api`'s `/chat` SSE stream is unchanged. The portfolio doesn't need new event types because artifact opens are client-driven, not server-driven. The matcher still returns `pairId`, `tier`, `confidence`, `score`, `lowConfidence` — all consumed by the existing `parseSseStream` from `@simlm/types`.

## 7. Tweaks panel (dev-only)

`<DevTweaks>` floats at bottom-right when `import.meta.env.DEV === true`. Three select dropdowns + one toggle, persisted to `preferences.ts`:

- **Theme** — 25 options (all the named themes from the design source: cream, mono, riso, salmon, newsprint, sage, plum, mint, burgundy, steel, putty, linen, indigo, cocoa, brutalism, glass, brutalism2, glass2, editorial, pavilion, carbon, vermillion, onyx, press, massimo, cover, engraver, quartz). Default `press`.
- **Logo** — 5 options (badge, mono, bracket, pixel, blockcursor). Default `blockcursor`.
- **Hover** — 5 options (tint, border, slide, mark, underline). Default `tint`.
- **Locale** — `en` / `vi`. Default `en`.

In production builds, the panel is tree-shaken out (dead code via the `import.meta.env.DEV` gate). The chosen defaults are baked into `preferences.ts`'s initial state. The user will pick the final defaults before launch.

## 8. i18n

Same model as `apps/web`: `apps/portf/src/lib/i18n/en.ts` is the `as const` canonical dict; `vi.ts` mirrors its keys typed as `Record<keyof typeof en, string>`. `i18n.test.ts` enforces shape equality at runtime. Default is `'en'` (English-first audience: recruiters reading Long's portfolio).

Translatable strings live in `en.ts` (chrome only — chip labels, button text, headline, sub-line, footer). MDX artifact content is **NOT** translated in v1; English-only content. If Vietnamese artifacts are needed later, add `.vi.mdx` siblings and glob both.

## 9. Seeds

`seeds/portf/` holds chat-fallback Q&A — answers for when `matchArtifact` misses but the visitor still asks something the portfolio should handle (e.g., "What's your salary expectation?", "Are you open to relocating?", "What's your favorite editor?"). Format: same YAML the existing seed CLI consumes:

```yaml
- input: What's your salary expectation?
  response: '{{ name }} prefers to talk numbers after we both confirm the work is interesting. DM hvanlong@pm.me.'
  topic: portfolio/hire
  locale: en
- input: Are you open to relocating?
  response: Currently based in Hanoi · open to remote-first roles globally.
  topic: portfolio/hire
  locale: en
```

The `{{ name }}` template uses the existing `@simlm/template` (`app_config[name]`); we seed `name=Long Nguyễn` into the portf `app_config` via a one-shot migration-style insert in the seed CLI (since `app_config` is excluded from TRUNCATE per existing rules, the row survives test resets).

## 10. Open questions left for implementation

- **Threads persistence across reloads** — zustand's `persist` keeps them in localStorage; no server-side thread table needed. Confirm this is fine for a portfolio with low traffic and no need to recover threads cross-device.
- **`?artifact=` querystring vs sub-route** — the spec picks querystring to keep chat state stable. Reconsider if URL ugliness bothers the user before phase G.
- **Admin DB switcher in UI** — out of scope; revisit after both DBs have real content.

## 11. Phase plan

The user explicitly wants phase-by-phase review. Phases below; each lands as its own PR-equivalent commit cluster on `main` per existing project discipline.

| Phase | Title | Lands |
|---|---|---|
| A | Workspace plumbing | `.env.portf`, docker init, root scripts, `dev:portf` per-app scripts, `provision:portf` one-shot |
| B | Portfolio seeds + first matcher hit | `seeds/portf/*.yaml`, `portf` DB migrated, `pnpm seed:portf` works, `curl :3010/chat` returns a portfolio answer |
| C | `apps/portf` scaffold | Vite/Tailwind/React mirror of apps/web, `dev:portf` boots, blank `/` route renders Wordmark + press theme |
| D | V2 Home + Wordmark + tokens + DevTweaks | The spotlight page works; theme/logo/hover switchable in dev panel; chips don't yet submit |
| E | V1 Chat (sidebar + thread) | Submitting on V2 routes to a new `/chat/:id`, SSE chat works end-to-end against portf api, sidebar shows local thread list |
| F | MDX catalog + client-side artifact matcher + direct-hit open | Project/Writing/CV MDX files render, `matchArtifact` triggers direct opens, ambiguous shows disambiguation chips, miss falls back to chat |
| G | V3 Artifact pane (desktop) + mobile fullscreen + deep links | Full V3 from the design, `/artifact/:kind/:slug` deep-linkable, `?artifact=` querystring restores pane on reload |
| H | i18n wiring + final polish | `lib/i18n` mirrors apps/web, NotFound, mobile burger menu, real avatar + CV PDF in `/assets/`, README |

Each phase's commit message mirrors existing project convention (`feat: implement phase X portf …`). User reviews each phase before the next starts.

## 12. CLAUDE.md updates

After phase H lands, `CLAUDE.md` gets a new "## apps/portf — portfolio web app" section with rules learned in implementation. Anticipated additions:

- "Artifact matching is client-side first; the matcher is the fallback, not the primary."
- "Two-instance api launch pattern — `.env.portf` is the source of truth for the second instance; never duplicate vars into a third file."
- "MDX content is glob-imported at build; adding an artifact = add one .mdx; no JS registry to update."
- "Portfolio default locale is `'en'`, not `'vi'`. The SimML rule about `'und'` fallback in matcher still applies; portfolio seeds are `'en'`, but matcher will still cascade to `'und'` rows if any leak in."
