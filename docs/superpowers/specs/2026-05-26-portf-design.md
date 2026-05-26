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
│  │  ├─ AppShell.tsx      # data-theme="press" wrapper, Sonner toaster (no data-logo / data-hover — single variant each ships)
│  │  ├─ Wordmark.tsx      # blockcursor only (Silkscreen 8BU badge + blinking caret); other logo variants from the design are NOT ported
│  │  └─ ui/               # shadcn primitives copied (button, dialog, input, textarea) — dropdown/tooltip added only when a feature needs them
│  ├─ features/
│  │  ├─ home/             # V2 spotlight (the "/" pane)
│  │  ├─ chat/             # V1 sidebar + thread pane; thread mgmt UI (revisit/rename/delete) lives here
│  │  └─ artifact/         # V3 pane + ProjectView / WritingView / CVView wrappers + MDX components + matcher
│  ├─ routes/              # PortfShell (always-mounted), Home, ChatView, ArtifactPane, NotFound — see §5 for the nested-route shape
│  ├─ store/               # session.ts, preferences.ts, threads.ts (persisted thread list w/ rename/delete), artifacts.ts
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

Both databases share the same migrations. The migration runner currently lives in `packages/db/src/migrate.ts` with SQL files at `packages/db/migrations/`.

> **Open question — migration ownership.** User flagged this location as inconvenient. Two reasonable refactors, both deferred until after the portf MVP lands so we don't entangle a structural change with a product launch:
>
> 1. **Move to `apps/api/migrations/` + `apps/api/scripts/migrate.ts`** — apps/api is the *only* process that owns this schema; co-locating its migrations matches "the app owns its data" convention. `apps/admin-api` still reads via `@simlm/db` repositories (unchanged); only the migrate runner relocates. Trade-off: when contributors run `pnpm migrate`, they're invoking an apps/* script which feels less library-like.
> 2. **Keep where it is, fix the invocation ergonomics** — current spec already does this (root `migrate:portf` calls `tsx --env-file=.env.portf packages/db/src/migrate.ts up` directly, no `pnpm --filter` ceremony).
>
> The spec proceeds with option 2 for now; option 1 is a tracked follow-up.

### 4.3 New `.env.portf` file

A second env file sits at repo root. Loaded via `tsx --env-file=.env.portf`:

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
```

`FALLBACK_MESSAGE` is intentionally omitted — that env var is on the deprecation path and will be dropped from the repo's `.env` template. The portfolio fallback comes from `app_config[fallback_message_en]` per the existing `chat-handler.ts` lookup chain (see CLAUDE.md "`app_config[fallback_message_<locale>]` is the canonical no-match line").

### 4.4 New root scripts

**Naming rule the user set:** `dev:simlm` and `dev:portf` are parallel namespaces. Each boots its own product's processes only. There is no umbrella `dev:all`.

```jsonc
{
  "scripts": {
    // Rename existing dev → dev:simlm. dev:simlm and dev:portf are siblings.
    "dev:simlm":       "turbo run dev",                                                 // existing dev task, unchanged behavior
    "dev:portf":       "turbo run dev:portf",                                           // fan-out: every package with dev:portf runs

    "migrate":         "tsx --env-file=.env packages/db/src/migrate.ts up",             // tighter than `pnpm --filter @simlm/db migrate up`
    "migrate:portf":   "tsx --env-file=.env.portf packages/db/src/migrate.ts up",
    "seed:portf":      "tsx --env-file=.env.portf packages/db/src/scripts/seed.ts seeds/portf/*.yaml --locale=en",
    "provision:portf": "tsx scripts/provision-portf-db.ts"
  }
}
```

`dev:simlm` keeps the existing `turbo run dev` semantics (Phase 0–13 untouched); the rename is just the alias. The original `dev` and `dev:all` root scripts get renamed in a tiny pre-phase commit so muscle memory and CI both keep working: keep `dev` as an alias of `dev:simlm` for one release, then drop. `dev:all:simlm` → `dev:all` line in the original spec was a mistake; replaced.

Turbo's `dev:portf` task fans out across every workspace that defines a `dev:portf` script:

```jsonc
// apps/api/package.json
"dev:portf": "tsx watch --env-file=../../.env.portf src/index.ts"

// apps/admin-api/package.json
"dev:portf": "tsx watch --env-file=../../.env.portf src/index.ts"

// apps/portf/package.json
"dev:portf": "vite"   // alias of dev; lets one turbo invocation boot all three
```

`turbo.json` needs a `dev:portf` task definition mirroring the existing `dev` task (`{"persistent": true, "cache": false}`). No source changes to `apps/api` or `apps/admin-api`. Running `pnpm dev:portf` boots all three portf processes in parallel; `Ctrl-C` tears them all down via turbo's signal propagation. Running `pnpm dev:simlm` boots the existing four simlm processes the same way. Run them in two terminals if you want both products live.

### 4.5 Admin reuse — switching DBs

`apps/admin` Vite proxy is fixed to `http://127.0.0.1:3001` (simlm admin-api). To manage portf, operator runs **the same admin SPA pointed at `:3011`** via a Vite env var:

```bash
VITE_ADMIN_API_TARGET=http://127.0.0.1:3011 pnpm --filter @simlm/admin dev
```

`apps/admin/vite.config.ts` is patched once to read `VITE_ADMIN_API_TARGET ?? 'http://127.0.0.1:3001'`. Both products' admin lives in one process at a time; operator switches sessions. (A future enhancement could ship a runtime DB-picker in the admin UI; out of scope here.)

## 5. Routes & client behavior

### 5.1 Hard rule: one shell, never unmount

The user's directive: navigating between Home, a chat thread, and an artifact must be **seamless** — widgets snap in and out of a single, always-mounted shell. No full-page transitions. No mid-flight loss of input state. The route tree is built around this.

### 5.2 Route tree (React Router 7 nested routes)

```tsx
<Routes>
  <Route element={<PortfShell />}>                            {/* never unmounts; owns sidebar + Outlet */}
    <Route index element={<HomePane />} />                    {/* / — V2 spotlight */}
    <Route path="chat/:threadId" element={<ChatPane />}>      {/* V1 conversation */}
      <Route path="artifact/:kind/:slug" element={<ArtifactPane />} />  {/* opens in ChatPane's right outlet */}
    </Route>
    <Route path="artifact/:kind/:slug" element={<ArtifactStandalone />} /> {/* deep-link, no current thread */}
    <Route path="*" element={<NotFound />} />
  </Route>
</Routes>
```

**Resulting URL → DOM shape table:**

| URL | `PortfShell` renders | Notes |
|---|---|---|
| `/` | Sidebar (empty state) · `<HomePane>` | V2 spotlight, no thread |
| `/chat` | redirect to `/chat/<freshUuid>` | `<Navigate>` element on `/chat` index |
| `/chat/:id` | Sidebar · `<ChatPane>` (full width) | V1 conversation, no artifact |
| `/chat/:id/artifact/:kind/:slug` | Sidebar · `<ChatPane>` (left 46%) · `<ArtifactPane>` (right 54%, slides in via CSS transition) | Both panes mounted; ChatPane stays interactive |
| `/artifact/:kind/:slug` | Sidebar · `<ArtifactStandalone>` (full width) | Direct-deep-link, no thread context. Mobile: fullscreen with ← BACK to `/` |
| `*` | Sidebar · `<NotFound>` | Sidebar still rendered so user can pick a thread |

**Why this works:**

- `PortfShell` mounts once and lives for the session — sidebar, theme wrapper, sonner toaster never get torn down.
- `ChatPane` mounts on first navigation to `/chat/:id` and stays mounted as long as the URL prefix matches. Going from `/chat/:id` to `/chat/:id/artifact/:kind/:slug` adds a child segment — React Router renders the child into `<Outlet />`, ChatPane re-renders but doesn't unmount, the composer keeps its typed-but-not-sent text.
- The split view is layout, not navigation: `<ChatPane>` renders a flex container and conditionally widths itself based on whether `<Outlet />` has children (`useMatches()` checks for nested artifact match).
- Sidebar thread switching (`/chat/A` → `/chat/B`) re-mounts `<ChatPane>` because `:threadId` changes. To avoid losing scroll/state across thread switches, ChatPane uses `useParams().threadId` as a key on its inner `<ThreadView key={threadId}>` so React resets thread-local state cleanly, but the shell + sidebar + outer composer chrome stay live.
- Closing the artifact: `<ArtifactPane>`'s × calls `navigate('..')` which drops the trailing artifact segment — `Outlet` becomes empty, `ChatPane` widens back to full. No layout flash because the right pane animates out via CSS `translateX(100%)` + the `<ArtifactPane>` is render-prop-wrapped in `<AnimatePresence>`-style logic (`react-transition-group` or a hand-rolled exit-delay).

**Mobile responsive shape (same routes, different CSS):**

- `<PortfShell>` collapses the sidebar to a `≡` burger trigger and renders `<MobileSidebarSheet>` (a dialog) on tap.
- On `/chat/:id/artifact/:kind/:slug`, the artifact takes the full viewport (the chat is visually hidden but stays mounted in the DOM); ← BACK navigates to `..`.
- On `/artifact/:kind/:slug` (no thread), ← BACK navigates to `/`.

### 5.3 Stores (zustand)

- `session.ts` — `sessionId` + setter, persisted under `portf.session`; copied from apps/web.
- `preferences.ts` — `primaryLocale: 'en' | 'vi'` (default `'en'`) + `theme: ThemeName` (default `'press'`). Persisted under `portf.preferences`. **No** `logo` / `hover` / `devTweaksOpen` keys — those options are removed entirely (see §7).
- `threads.ts` — persisted thread list `{ id, title, lastSnippet, ts, pinned? }[]` under `portf.threads`. Actions:
  - `create(title?) → id` — mints a new thread (uuid v4), inserts at index 0, returns id; called by `/` submit and the sidebar "+ New chat".
  - `rename(id, title)` — used by the sidebar's inline-edit-on-double-click affordance.
  - `remove(id)` — used by the sidebar row's context menu / hover-`×`. If the currently-routed `:threadId` is removed, `navigate('/')`.
  - `revisit(id)` — `navigate('/chat/' + id)`; the sidebar row click handler.
  - `touch(id, lastSnippet)` — called after each successful assistant reply; bubbles the thread to top + updates the snippet preview.
  - `setTitle(id, title)` — auto-titling: the first 32 chars of the first user message become the initial title; can be renamed later.
- `artifacts.ts` — actually unnecessary. Currently-open artifact is fully derived from the URL (`useParams().kind/slug`). Skip the store; read params at the render boundary. (Original spec planned this store; removed during review.)

### 5.4 Match-and-route logic

`onComposerSubmit(input, currentThreadId | null)`:

```ts
const matched = matchArtifact(input);                                // {direct?, ambiguous?, miss}

if (matched.kind === 'direct') {
  const threadId = currentThreadId ?? threads.create();              // ensure a thread exists
  threads.append(threadId, { role: 'user', text: input });           // we still log the prompt in the thread
  navigate(`/chat/${threadId}/artifact/${matched.ref.kind}/${matched.ref.slug}`);
  return;                                                            // NO /chat API call
}

// ambiguous + miss both call the API
const threadId = currentThreadId ?? threads.create();
navigate(`/chat/${threadId}`);                                       // no-op if already there
threads.append(threadId, { role: 'user', text: input });
streamChat({ message: input, sessionId, locale: prefs.primaryLocale })
  .onEvent(/* … */);                                                 // assistant bubble fills in

if (matched.kind === 'ambiguous') {
  // Render disambiguation chip row above the assistant bubble.
  threads.appendDisambig(threadId, matched.candidates);              // chip click → navigate(`…/artifact/…`)
}
```

Calling `navigate(`/chat/${id}/artifact/…`)` from `/chat/${id}` adds the nested segment — `ChatPane` stays mounted; `Outlet` paints the artifact; the right pane animates in. No remount, no scroll loss, no composer-text loss.

## 6. SSE protocol — no changes

`apps/api`'s `/chat` SSE stream is unchanged. The portfolio doesn't need new event types because artifact opens are client-driven, not server-driven. The matcher still returns `pairId`, `tier`, `confidence`, `score`, `lowConfidence` — all consumed by the existing `parseSseStream` from `@simlm/types`.

## 7. Baked defaults — no tweaks panel ships

User decision: **drop the runtime tweaks panel entirely**. Defaults are hardcoded; logo and hover have **only one variant** each in the codebase; theme keeps all 25 CSS variants in the stylesheet so a future theme switcher (separate phase, not this spec) can flip `[data-theme=…]` at runtime without a code change.

Baked defaults (per the user's screenshot, 2026-05-26):

| Token | Value | Source |
|---|---|---|
| `data-theme` | `press` | `<PortfShell data-theme="press">` (literal — preferences store does not own it for v1) |
| Logo | `blockcursor` | Wordmark.tsx renders the Silkscreen 8BU badge + blinking caret only. No CSS `[data-logo]` selectors needed. |
| Sidebar row hover | `tint` | Sidebar CSS uses only the `:hover { background: var(--cream-card) }` variant. No `[data-hover]` selectors. |

**Concretely the ports differ from the design:**

- `Wordmark.tsx` ports only the `wm-mark-blockcursor` markup from `primitives.jsx`. The other four marks (`badge`, `mono`, `bracket`, `pixel`) are not copied. CSS for `.wm-mark-badge`, `.wm-mark-mono`, etc. is also dropped — the file shrinks substantially.
- `components.css` ports only the `[data-hover="tint"]` ruleset — but the `[data-hover="tint"]` attribute selector is removed from the rules entirely; styles apply directly to `.v1-thread:not(.active):hover`. The other four hover modes (`border`, `slide`, `mark`, `underline`) are not copied.
- `theme.css` ports **all 25** `[data-theme=…]` rulesets verbatim (cream, mono, riso, salmon, newsprint, sage, plum, mint, burgundy, steel, putty, linen, indigo, cocoa, brutalism, glass, brutalism2, glass2, editorial, pavilion, carbon, vermillion, onyx, press, massimo, cover, engraver, quartz) plus their theme-specific element overrides at the file's bottom. The CSS is the entire surface area of the future switcher.

If a theme switcher ships later, it just flips `<PortfShell data-theme="X">` from a select — no code change needed in `theme.css`. The future ticket is "add a theme switcher UI"; this spec ensures the data is already there.

## 8. i18n

Same model as `apps/web`: `apps/portf/src/lib/i18n/en.ts` is the `as const` canonical dict; `vi.ts` mirrors its keys typed as `Record<keyof typeof en, string>`. `i18n.test.ts` enforces shape equality at runtime. Default is `'en'` (English-first audience: recruiters reading Long's portfolio).

Translatable strings live in `en.ts` (chrome only — chip labels, button text, headline, sub-line, footer). MDX artifact content is **NOT** translated in v1; English-only content. If Vietnamese artifacts are needed later, add `.vi.mdx` siblings and glob both.

## 9. Seeds

`seeds/portf/` will hold chat-fallback Q&A for when `matchArtifact` misses but the visitor asks something the portfolio should handle (salary expectations, relocation, favorite editor, etc.). Format follows the existing seed CLI's YAML. **Concrete seed authoring is deferred** — placeholder file ships in phase B with a few smoke-test entries; we'll brainstorm the actual portfolio Q&A corpus as its own session before writing it out.

```yaml
# seeds/portf/_placeholder.yaml — phase B smoke test only; replace before launch
- input: ping
  response: pong — portfolio matcher alive
  topic: portfolio/smoke
  locale: en
```

The `{{ name }}` template hook (existing `@simlm/template` reading `app_config[name]`) will be used in the real seeds; seeding `name=Long Nguyễn` happens in phase B as a tiny INSERT alongside the placeholder rows so the template path is exercised from day one.

## 10. Threads — persistence and management

Persisted via zustand's `persist` middleware under `portf.threads` in localStorage. **No server-side thread table** — the api's `sessions` row stores the session, not the thread list. Threads are a client-only construct that maps `id → (title, lastSnippet, ts, messages)`. Trade-off: threads are device-local (no cross-device sync); for a portfolio with low traffic and visitor-driven sessions, that's acceptable.

The sidebar is the management surface. From the design:

```
┌───────────────────────┐
│ 8BU_  Senior Web Dev  │
│ [+ New chat]          │
│ ─── Today ───────     │
│ • About me      now   │  ← active row: filled background + coral dot
│ • Best project? 2m    │
│ • Stack & tools 5m    │
│ ─── Earlier ─────     │
│ • Hire me      12m    │
│ • Past roles    1h    │
│ • Coffee chat?  1d    │
│ ─── (avatar) ───      │
│ ◉ hvanlong@pm.me      │
└───────────────────────┘
```

Operations the sidebar must support (zustand actions in `threads.ts`):

| Action | UI affordance | Behavior |
|---|---|---|
| **Create** | `[+ New chat]` button at top | Mints uuid, navigates to `/chat/<id>`. Empty thread shows V2 spotlight inside the chat pane (composer + chips, no messages yet) — V2 isn't a separate route, it's the empty state of a thread. *Revision: see §5.2 — `/` (HomePane) renders V2 standalone; an empty `/chat/:id` renders V2-shaped welcome in the conversation area until the first message lands.* |
| **Revisit** | Click thread row | `navigate('/chat/' + id)` — ChatPane swaps its inner `<ThreadView key={id}>`. |
| **Rename** | Double-click title (desktop) / long-press (mobile) | Inline contenteditable; commit on Enter/blur, discard on Esc. Auto-title on first message: thread title is set to the first 32 chars of the user's first message if untitled. |
| **Delete** | Hover-revealed `×` on the right side of the row (desktop) / swipe-left (mobile) | Confirms via `<Dialog>` (shadcn) — "Delete '<title>'?" — then removes the thread; if the currently-routed `:threadId` is removed, `navigate('/')`. |
| **Pin** *(stretch)* | Right-click → "Pin" or a context menu | Pinned threads sort to the top under a "Pinned" section header above "Today". Deferred to a post-MVP polish phase. |
| **Group by recency** | Section labels "Today" / "Earlier" | Pure render-time grouping: `threads.filter(t => Date.now() - t.ts < 24*3600*1000)` vs the rest. No persisted state. |

The grouping logic ("Today" / "Earlier") and the `touch(id, lastSnippet)` bubble-to-top behavior on assistant reply are non-negotiable — both visible in the design's `V1Sidebar` and called out implicitly by the design's `meta: "now" | "2m" | "1d"` labels. Phase E implements all of these except **Pin**, which is the only stretch item.

## 11. Open questions left for implementation

- **Threads cross-device sync** — out of scope (device-local only). If the user ever wants visitor history persisted across devices, a `threads` table on the api + an "import threads from this device" button covers it; spec'd later if needed.
- **Admin DB switcher in UI** — out of scope; revisit after both DBs have real content.
- **Migration ownership relocation** — see §4.2's open question. Deferred refactor.
- **Empty `/chat/:id` UX** — §10 picks "V2-shaped welcome inside the conversation area until the first message". Phase E may want to revisit if the duplication with `HomePane` feels wrong; one option is to redirect empty threads back to `/`.

## 12. Phase plan

The user explicitly wants phase-by-phase review. Phases below; each lands as its own PR-equivalent commit cluster on `main` per existing project discipline. **Major phases can be broken into sub-tasks for finer review** at the user's request before they start.

| Phase | Title | Lands |
|---|---|---|
| A | Workspace plumbing + script rename | `.env.portf`, docker init, root scripts (incl. `dev` → `dev:simlm` rename + `dev:portf`), per-app `dev:portf` scripts, `provision:portf` one-shot, `turbo.json` task def, admin `VITE_ADMIN_API_TARGET` patch |
| B | Portf DB up + smoke seed | `portf` DB migrated, `seeds/portf/_placeholder.yaml` works, `curl :3010/chat -d '{"message":"ping"}'` returns "pong" through portf api instance |
| C | `apps/portf` scaffold | Vite/Tailwind/React mirror of apps/web, `dev:portf` boots, blank `/` route renders Wordmark + press theme, all 25 themes shipped in theme.css |
| D | V2 Home (`HomePane`) | Spotlight page renders; composer submits and routes to `/chat/<newId>` (chat itself stubbed until phase E) |
| E | V1 Chat (`PortfShell` + sidebar + `ChatPane`) + threads store | Sidebar with create/revisit/rename/delete + "Today/Earlier" grouping + auto-title, SSE chat works end-to-end against portf api, mobile burger sheet |
| F | MDX catalog + client-side artifact matcher + direct-hit routing | `content/artifacts/**/*.mdx` glob-imported, `matchArtifact()` returns direct/ambiguous/miss, direct opens jump to nested route, ambiguous shows disambiguation chip row, miss falls back to chat |
| G | `ArtifactPane` (split, nested) + `ArtifactStandalone` (deep link) + mobile fullscreen | Project / Writing / CV renderers, nested `/chat/:id/artifact/:kind/:slug` slides in without remounting `ChatPane`, mobile fullscreen with ← BACK, all transitions seamless |
| H | i18n + final polish | `lib/i18n` mirrors apps/web (en + vi), NotFound, real avatar + CV PDF in `/assets/`, README |

Each phase's commit message mirrors existing project convention (`feat: implement phase X portf …`). User reviews each phase before the next starts. Phases E and G are the largest — expect to break them into sub-tasks during implementation.

## 13. CLAUDE.md updates — deferred to a separate task

User decision: **do not modify the root `CLAUDE.md` in this work**. Instead, the implementation captures observed rules in a new file at repo root:

`CLAUDE.note.md` — a running buffer of paragraphs that should eventually become `CLAUDE.md` entries. Format: one section per phase, each section a list of bullet-format claims about discipline learned in implementation. A separate agent (not this thread) will fold these into `CLAUDE.md` in a future task, preserving the existing organization.

Why this separation: `CLAUDE.md` is already dense and structured around SimML; adding portfolio rules inline risks merge conflicts and breaks the SimML-focused narrative until a dedicated curation pass can integrate them properly. The buffer file is cheap to create, cheap to read, and zero-risk for the existing doc.

Anticipated entries (these will be written into `CLAUDE.note.md` as phases land — listed here so we know what to capture):

- "Artifact matching is client-side first; the matcher is the fallback, not the primary."
- "Two-instance api launch pattern — `.env.portf` is the source of truth for the second instance; no third env file or in-process multi-tenancy."
- "MDX content is glob-imported at build; adding an artifact = add one .mdx; no JS registry to update."
- "Portfolio default locale is `'en'`, not `'vi'`. The SimML `'und'` fallback rule still applies."
- "Portf web has no shadcn theme switcher in v1 — all 25 themes ship in `theme.css` for a future switcher to flip without code change."
- "`dev:simlm` and `dev:portf` are siblings — there is no `dev:all`. Run each in its own terminal if you need both products live."
- "`PortfShell` never unmounts. `ChatPane` stays mounted across artifact open/close because the artifact is a nested route, not a sibling."
- "Threads are client-only (localStorage). The api's `sessions` table stores session keys, not thread lists."
