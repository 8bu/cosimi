# Deploying cosimi to Cloudflare + Neon

All deploys are **manual** via `./deploy.sh`. No CI/CD. No VPS/Docker/Caddy/Tunnel.

## Current state (2026-06-02) — portf is LIVE

**portf is deployed and serving end-to-end at `https://8bu.dev` (pages + chat).**
- `portf-api` Worker live on route `8bu.dev/api/*` (env.portf), cron `*/5`. `/api/healthz` → `db:up`.
- `portf` Pages project live; custom domain `8bu.dev` bound at the apex. SPA routes all 200.
- Neon project `6sf` (`shiny-sky-20616499`, aws-ap-southeast-1, pg17), branch `production`. `portf` DB seeded (459 pairs, 10 batches). `cosimi` DB migrated, not yet deployed.
- Hyperdrive wired in `apps/api/wrangler.toml`: `portf-hd` `7994710a22e94e3fab65ac8deaa79a59`, `cosimi-hd` `9b92a20da27b4c68a6cc2fc27e7c8bd1`. Both point at the Neon **direct** endpoint (`ep-old-butterfly-aokyc4hs...`, no `-pooler`) so postgres.js prepared statements work.

**cosimi (`apps/web` + `cosimi-api`) is NOT deployed** — Hyperdrive + env.cosimi are wired and ready, but no Pages project / domain bound yet.

### Two Workers-runtime fixes applied during the first deploy
See "Workers runtime constraints" below — both are now in code (commits `41bca57`, `639fa2e`):
- **request-scoped DB client** — a module-level postgres.js pool threw `Cannot perform I/O on behalf of a different request` (intermittent). Now `runWithRequestDb` + `AsyncLocalStorage`.
- **lazy logger** — `createLogger()`/`loadEnv()` at import failed wrangler's deploy-time startup validation (no `DATABASE_URL` binding present then).

## Topology

| App | Package | CF product | Build output | Domain |
|---|---|---|---|---|
| portf | `@portf/web` | Pages (`portf`) | `apps/portf/dist/client` | `8bu.dev` |
| web | `@cosimi/web` | Pages (`cosimi-web`) | `apps/web/dist` | `cosimi.8bu.dev` |
| api (portf) | `@cosimi/api` | Worker (`portf-api`, `env.portf`) | bundled | route `8bu.dev/api/*` |
| api (cosimi) | `@cosimi/api` | Worker (`cosimi-api`, `env.cosimi`) | bundled | route `cosimi.8bu.dev/api/*` |

DB: Neon (two DBs - portf, cosimi). Worker reaches Neon via **Hyperdrive**.

## One-time setup

### 1. Neon
- Create a Neon project. Create two databases: `portf`, `cosimi`.
- For each, copy both the **pooled** (`-pooler` host) and **direct** connection strings (`sslmode=require`).

### 2. Hyperdrive (one per DB - give it the Neon **direct** string, NOT pooled)
Direct endpoint = the Neon connection string with `-pooler` removed from the host. Direct (not pooled) so Hyperdrive does the pooling and postgres.js prepared statements keep working (the pooled/pgBouncer transaction endpoint rejects named prepared statements).
```
pnpm --filter @cosimi/api exec wrangler hyperdrive create portf-hd  --connection-string="<neon-portf-direct>"
pnpm --filter @cosimi/api exec wrangler hyperdrive create cosimi-hd --connection-string="<neon-cosimi-direct>"
```
Copy each printed id into `apps/api/wrangler.toml` and `apps/api/spike/wrangler.spike.toml`. (Already done — see "Current state".)

### 3. Migrate (direct URL - DDL must run off the pooler)
`./deploy.sh` -> option 7 -> choose DB(s) -> paste the Neon **direct** URL when prompted.
(`migration 001` creates `pg_trgm` / `unaccent` extensions + the `f_unaccent` function, which require a real session, not the transaction pooler.)

### 4. Seed (operator-run, optional)
```
DATABASE_URL="<neon-portf-direct>"  node_modules/.bin/tsx packages/db/src/scripts/seed.ts "<portf glob>"
DATABASE_URL="<neon-cosimi-direct>" node_modules/.bin/tsx packages/db/src/scripts/seed.ts "<vi/chatterbot glob>"
```

### 5. Spike (OPTIONAL veto gate)
`./deploy.sh` -> option 1. Open the printed `workers.dev` URL. Require `{"ok":true,"paramOk":true}`.
- If `ok:false` -> Hyperdrive/Neon path is broken; fall back (see "Connection fallback").
- If `paramOk:false` with a prepared-statement error -> set `prepare: false` in `packages/db/src/client.ts` (or behind a `DB_PREPARE` env) before deploying the real worker.

Now redundant for portf: the real worker's `/api/healthz` hits the same postgres.js -> Hyperdrive -> Neon path, so a `db:up` from the deployed worker proves it just as well. Keep the spike only when introducing a NEW Hyperdrive/DB binding.

### 6. Create the Pages project (first time per app — `deploy.sh` does NOT do this)
`deploy.sh`'s pages deploy assumes the project exists; first time you must create it:
```
pnpm --filter @cosimi/api exec wrangler pages project create portf      --production-branch=production
pnpm --filter @cosimi/api exec wrangler pages project create cosimi-web --production-branch=production
```

### 7. First deploy
- portf only: `./deploy.sh` -> option 2 (Pages) + option 4 (portf-api Worker).
- everything: `./deploy.sh` -> option 6 (Deploy ALL).

The pages deploy runs from `apps/api` (where wrangler lives) and warns "we detected a configuration file … missing pages_build_output_dir" — that's the worker `wrangler.toml`; Pages ignores it, harmless. Pass an absolute `dist/client` path and `--commit-dirty=true` when the tree is dirty.

### 8. Domains + routes (Cloudflare dashboard - DNS changes are operator-confirmed, per change)
- Pages -> `portf` project -> Custom domains -> add `8bu.dev`.
- Pages -> `cosimi-web` project -> Custom domains -> add `cosimi.8bu.dev`.
- Worker routes are declared in `wrangler.toml` and applied on `wrangler deploy`; confirm in dash:
  `8bu.dev/api/*` -> `portf-api`, `cosimi.8bu.dev/api/*` -> `cosimi-api`.

**Apex gotcha (the `8bu.dev` first-deploy `525`):** `8bu.dev` was a pre-existing zone with stale proxied apex `A`/`AAAA` records pointing at an old origin under SSL/TLS Full(strict). The Worker route `8bu.dev/api/*` intercepts before origin so `/api/*` works, but every non-`/api` path falls through to the dead origin → **525 SSL handshake failed**. Fix: add the Pages custom domain at the apex and let CF replace/delete the stale records with its managed CNAME-flatten record (no origin). `/api/*` keeps working through it.

`wrangler` has **no** Pages custom-domain subcommand (as of 4.94) — binding is dashboard/API only.

### 9. Verify
`./deploy.sh` -> option 9. Then load `https://8bu.dev/` , `https://8bu.dev/chat/anything` (SPA fallback), `https://8bu.dev/artifacts`, and send a chat (proves Worker -> Hyperdrive -> Neon live).

`*.pages.dev` chat does NOT work and that is BY DESIGN: the build ships a relative `API_BASE=/api`, and the Worker route only exists on the custom domain — `pages.dev` has no backend. Test chat on `8bu.dev`, never `portf-mb6.pages.dev`.

## Workers runtime constraints (do not regress)
The worker bundles the full Hono app via esbuild. Two traps were hit on the first deploy:
- **No module-level DB connection.** workerd binds each socket to the request that opened it; a shared pool reused across requests throws `Cannot perform I/O on behalf of a different request`. `@cosimi/db` exposes `runWithRequestDb(fn)` (an `AsyncLocalStorage`-scoped per-request client) which `worker.ts` wraps `fetch` and `scheduled` in. `sql()` prefers the request-scoped client, falling back to the process singleton for Node (dev/prod/tests). Any new entrypoint that touches the DB on Workers MUST run inside `runWithRequestDb`.
- **No `loadEnv()` at import time.** Cloudflare runs the worker's global scope during deploy-time startup validation with NO bindings, so `DATABASE_URL` is absent and valibot rejects. Keep `loadEnv()` lazy (called inside handlers). The api logger is a lazy `Proxy` for this reason; `hoistEnv` in `worker.ts` bridges the Hyperdrive binding into `process.env.DATABASE_URL` per request, before any `loadEnv()` runs.
- **pino logs are invisible to `wrangler tail`.** pino writes to stdout, which workerd does not surface. Only `console.*` shows in `tail`. To debug a deployed worker, add a temporary `console.error` (the SSE catch in `apps/api/src/lib/sse.ts` is the spot for chat errors), deploy, reproduce, then revert.

## Ongoing deploys
`./deploy.sh` -> option 2/3/4/5 for a single target, or 6 for all. Gates run automatically first.

## Connection fallback (if the Worker -> Hyperdrive -> Neon path fails)
1. Direct TCP (no Hyperdrive): set a `DATABASE_URL` **secret** (`wrangler secret put DATABASE_URL -e <env>`), remove the `[[hyperdrive]]` block, and the worker's `hoistEnv` picks up the secret string. (Use the Neon pooled URL.)
2. Last resort: swap `@cosimi/db` to `@neondatabase/serverless` (invasive - separate task).

## Notes
- `wrangler` is a deploy-only devtool. If the 7-day dependency embargo (`pnpm-workspace.yaml`) blocks its install, add `wrangler` to `minimumReleaseAgeExclude`.
- Never commit `.env*`. `DATABASE_URL` in production comes from Hyperdrive at runtime, never from a committed file.

## Autonomous decisions pending operator confirmation
- **No GitHub Actions** (no gates CI). Still manual. Add later if wanted.
- **Two worker envs** - `cosimi-api` (env.cosimi) is wired but undeployed. Kept as-is through the portf deploy. Drop `env.cosimi` + its route + the cosimi DB if `apps/web` should ship SPA-only; otherwise deploy it when `apps/web` ships.
