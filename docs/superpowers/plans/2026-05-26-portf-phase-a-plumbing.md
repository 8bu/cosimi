# 8bu.dev portfolio — Phase A: workspace plumbing implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land everything needed to run `apps/api` and `apps/admin-api` as a second instance against a new `portf` Postgres database, with root scripts (`dev:simlm` + `dev:portf` as siblings) wired through turbo. No application code yet — this phase is purely workspace, env, db init, and a deps audit.

**Architecture:** A second `portf` database lives alongside `simlm` in the existing PG container, provisioned via a docker init script (and a one-shot script for contributors who already have a volume). The same `apps/api` / `apps/admin-api` source is launched a second time via a `dev:portf` script that loads `.env.portf` and binds different ports. `turbo run dev:portf` fans this out. The `apps/admin` SPA gains a `VITE_ADMIN_API_TARGET` env knob so the operator can point it at either admin-api instance.

**Tech Stack:** Postgres 16-alpine (existing container), Docker Compose, pnpm 11 workspaces, Turbo 2, tsx 4, postgres.js 3 (existing), Vite 6 (existing — Phase A audits whether to bump).

**Scope of this plan:** Phase A only. Phase B (portf seeds + first matcher hit) is a separate plan written after A lands.

---

## File map

**New files:**
- `.env.portf.example` — second env file template. Operator copies → `.env.portf` for local dev.
- `db/init/01_portf.sql` — Postgres init script; runs on fresh volume; creates `portf` database next to `simlm`.
- `scripts/provision-portf-db.ts` — idempotent one-shot for contributors with an existing `simlm` volume (init scripts only run on first volume init).
- `scripts/provision-portf-db.test.ts` — vitest covering idempotency.
- `docs/dep-audit-2026-05-26.md` — LTS audit report produced by Task 11.

**Modified files:**
- `.gitignore` — add `.env.portf` (existing `.env` line doesn't glob).
- `docker-compose.dev.yml` — mount `./db/init` as `/docker-entrypoint-initdb.d:ro`.
- `apps/api/package.json` — add `dev:portf` and `start:portf` scripts.
- `apps/admin-api/package.json` — add `dev:portf` and `start:portf` scripts.
- `apps/admin/vite.config.ts` — read `VITE_ADMIN_API_TARGET` from env; fallback unchanged.
- `turbo.json` — add `dev:portf` task definition mirroring `dev`.
- `package.json` (root) — rename `dev` → `dev:simlm` (keep `dev` as alias for one release), tighten `migrate` (drop `pnpm --filter @simlm/db` ceremony), add `migrate:portf`, `seed:portf`, `provision:portf`, `dev:portf`.

**Not touched in Phase A:**
- `apps/portf` does not exist yet (Phase C creates it; its `dev:portf` is added then).
- `.env.example` — the user is removing `FALLBACK_MESSAGE` separately; don't pre-empt.
- `apps/admin/package.json` — admin's `dev` script is unchanged; the env-target switch is a Vite config concern only.
- `packages/db` — migration relocation is a deferred refactor (see spec §4.2).

---

## Task 1: Add `.env.portf.example` template + gitignore entry

**Files:**
- Create: `.env.portf.example`
- Modify: `.gitignore` (add line for `.env.portf`)

- [ ] **Step 1: Create the env template**

Create `.env.portf.example` with portf-specific values. Note: no `FALLBACK_MESSAGE` (deprecated; fallback comes from `app_config[fallback_message_en]` per spec §4.3).

```env
# --- Required ---
DATABASE_URL=postgres://postgres:postgres@localhost:5432/portf

# --- Optional (all have defaults inside @simlm/config) ---
NODE_ENV=development
PORT=3010
ADMIN_PORT=3011
ADMIN_HOST=127.0.0.1
LOG_LEVEL=info

# Cache + GC
GC_INTERVAL_MS=300000
SESSION_TTL_HOURS=24
SESSION_TEACH_TTL_MINUTES=10

# Matching thresholds — portfolio is more conservative than simlm to
# prefer fallback over near-miss noise on a small corpus.
MATCH_FTS_MIN=0.15
MATCH_TRGM_MIN=0.5
MATCH_TOP_K=5

# SSE pacing (same as simlm)
SSE_DELAY_MODE=token
SSE_DELAY_BASE_MS=30
SSE_DELAY_JITTER_MS=20

# Teach guardrails — portfolio chat is read-only; these are unused but
# included so @simlm/config's valibot schema parses cleanly.
TEACH_RATE_LIMIT_PER_HOUR=10
TEACH_MAX_LENGTH=500
TEACH_BLOCKLIST_REGEX=

# Behavior
PRUNE_SCORE_THRESHOLD=-3
```

- [ ] **Step 2: Add `.env.portf` to .gitignore**

The existing `.gitignore` has `.env` as a literal — does not glob. Add a separate line.

Modify `.gitignore`:

```diff
 node_modules/
 dist/
 .turbo/
 .env
+.env.portf
 .env.local
 *.log
 .DS_Store
 coverage/
 docs/SPEC_*.md
 *.tsbuildinfo
```

- [ ] **Step 3: Verify .env.portf would not be tracked**

Run: `git check-ignore -v .env.portf`
Expected: `.gitignore:5:.env.portf	.env.portf` (or similar — exit 0 means ignored).

- [ ] **Step 4: Operator hint — copy template to working file**

Document the manual step (the implementation agent should NOT auto-create `.env.portf` because secrets in a non-tracked file are the user's responsibility). Echo this to the user in the task summary:

> "Operator: `cp .env.portf.example .env.portf` before running Phase A tasks 4+."

- [ ] **Step 5: Commit**

```bash
git add .env.portf.example .gitignore
git commit -m "feat(portf): add .env.portf.example template + gitignore"
```

---

## Task 2: Add docker init script for `portf` database

**Files:**
- Create: `db/init/01_portf.sql`
- Modify: `docker-compose.dev.yml` (add init-scripts volume mount)

- [ ] **Step 1: Create the init SQL**

Create `db/init/01_portf.sql`. Postgres' entrypoint executes `*.sql` files in `/docker-entrypoint-initdb.d/` alphabetically against the default DB on first volume init.

```sql
-- Runs once on fresh container volume. Creates the `portf` database
-- alongside the default `simlm` one defined by POSTGRES_DB.
-- For existing volumes, use `pnpm provision:portf` instead.

SELECT 'CREATE DATABASE portf'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'portf')\gexec
```

The `\gexec` meta-command is a `psql` feature that executes whatever the previous query returned as SQL. Wrapping it in the `WHERE NOT EXISTS` guard makes the file safe to re-run (defensive — init scripts run once normally, but a manual psql replay shouldn't error).

- [ ] **Step 2: Mount the init dir in docker-compose**

Modify `docker-compose.dev.yml`:

```diff
 services:
   postgres:
     image: postgres:16-alpine
     container_name: simlm-postgres
     restart: unless-stopped
     environment:
       POSTGRES_USER: postgres
       POSTGRES_PASSWORD: postgres
       POSTGRES_DB: simlm
     ports:
       - "5432:5432"
     volumes:
       - simlm_pg_data:/var/lib/postgresql/data
+      - ./db/init:/docker-entrypoint-initdb.d:ro
     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U postgres -d simlm"]
       interval: 5s
       timeout: 5s
       retries: 10

 volumes:
   simlm_pg_data:
```

- [ ] **Step 3: Commit (no DB reset yet — that's Task 3)**

```bash
git add db/init/01_portf.sql docker-compose.dev.yml
git commit -m "feat(portf): add docker init script for portf database"
```

---

## Task 3: Reset the dev DB and verify `portf` database is created on init

**Files:** none modified — pure verification.

> ⚠️ **Destructive operation warning:** this drops the local dev volume. Confirm with the operator before running `pnpm db:reset`. If they have unmigrated/unseeded local data they care about, defer this task and use Task 4's `provision:portf` script against the live volume instead.

- [ ] **Step 1: Confirm with operator before destroying volume**

Ask:
> "About to `pnpm db:reset` to verify the new docker init script creates the portf database. This destroys the local simlm DB volume. OK to proceed? (Alternative: skip this task and rely on the Task 4 idempotent provisioner against the existing volume.)"

If the operator says no, mark this task skipped in the task list and proceed to Task 4 — `provision:portf` covers the same outcome non-destructively.

- [ ] **Step 2: Reset + bring up the container**

Run: `pnpm db:reset`
Expected: `docker compose -f docker-compose.dev.yml down -v` succeeds, then `db:up` runs healthcheck-wait and exits 0.

- [ ] **Step 3: Verify both databases exist**

Run: `docker exec simlm-postgres psql -U postgres -lqt | cut -d \| -f 1 | tr -d ' ' | grep -E '^(simlm|portf)$' | sort`
Expected output (two lines):
```
portf
simlm
```

- [ ] **Step 4: Commit (no file changes — just verifying the init flow)**

No commit needed in Task 3 — verification only. Move to Task 4.

---

## Task 4: Write idempotent `provision:portf` script + test

**Files:**
- Create: `scripts/provision-portf-db.ts`
- Create: `scripts/provision-portf-db.test.ts`

For contributors who already have a `simlm_pg_data` volume from before this change — Postgres won't re-run `/docker-entrypoint-initdb.d/` on a non-empty volume. This script connects to the `postgres` maintenance DB and runs `CREATE DATABASE portf` idempotently.

- [ ] **Step 1: Write the failing test**

Create `scripts/provision-portf-db.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { provisionPortfDb } from "./provision-portf-db.js";

// Talks to the actual local dev Postgres; this is an integration test by design.
// CI is expected to run docker-compose up before invoking vitest at the repo root.
const MAINTENANCE_URL = "postgres://postgres:postgres@localhost:5432/postgres";

async function dropPortfDb() {
  const sql = postgres(MAINTENANCE_URL);
  try {
    await sql`DROP DATABASE IF EXISTS portf WITH (FORCE)`;
  } finally {
    await sql.end();
  }
}

describe("provisionPortfDb", () => {
  beforeAll(async () => {
    await dropPortfDb();
  });

  afterAll(async () => {
    await dropPortfDb();
  });

  it("creates the portf database when absent", async () => {
    const created = await provisionPortfDb(MAINTENANCE_URL);
    expect(created).toBe(true);

    const sql = postgres(MAINTENANCE_URL);
    try {
      const rows = await sql<{ datname: string }[]>`
        SELECT datname FROM pg_database WHERE datname = 'portf'
      `;
      expect(rows.length).toBe(1);
    } finally {
      await sql.end();
    }
  });

  it("is idempotent — second run reports already-exists", async () => {
    const created = await provisionPortfDb(MAINTENANCE_URL);
    expect(created).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (import error)**

Run: `pnpm exec vitest run scripts/provision-portf-db.test.ts`
Expected: FAIL — cannot find module `./provision-portf-db.js`.

- [ ] **Step 3: Write the script**

Create `scripts/provision-portf-db.ts`:

```ts
import postgres from "postgres";

/**
 * Idempotent CREATE DATABASE portf against the Postgres maintenance DB.
 *
 * Returns true if the DB was actually created, false if it already
 * existed. Throws on any other Postgres error (permission, connection,
 * etc.) — caller decides whether to log + exit or surface.
 *
 * Connects to the maintenance database `postgres` because CREATE
 * DATABASE cannot run inside a transaction and the target DB obviously
 * doesn't exist yet.
 */
export async function provisionPortfDb(maintenanceUrl: string): Promise<boolean> {
  const sql = postgres(maintenanceUrl);
  try {
    const existing = await sql<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname = 'portf'
    `;
    if (existing.length > 0) return false;

    // sql.unsafe is required: CREATE DATABASE doesn't accept parameter
    // binding (the database name has to be an identifier literal).
    // The string "portf" is hardcoded — no user input flows here.
    await sql.unsafe('CREATE DATABASE "portf"');
    return true;
  } finally {
    await sql.end();
  }
}

// CLI entrypoint: tsx scripts/provision-portf-db.ts
//
// Reads DATABASE_URL from env (typically loaded via --env-file=.env.portf
// or --env-file=.env, doesn't matter — we rewrite the DB to `postgres`
// for the maintenance connection).
if (import.meta.url === `file://${process.argv[1]}`) {
  const portfUrl = process.env.DATABASE_URL;
  if (!portfUrl) {
    console.error("DATABASE_URL not set — pass --env-file=.env.portf or .env");
    process.exit(2);
  }
  // Replace the path component with /postgres for the maintenance connection.
  const maintenanceUrl = portfUrl.replace(/\/[^/?]*(\?|$)/, "/postgres$1");

  provisionPortfDb(maintenanceUrl)
    .then((created) => {
      console.log(created ? "created portf database" : "portf database already exists");
      process.exit(0);
    })
    .catch((err) => {
      console.error("provision failed:", err);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run scripts/provision-portf-db.test.ts`
Expected: PASS (2/2). If Postgres is not up, both tests fail with connection refused — run `pnpm db:up` first.

- [ ] **Step 5: Verify CLI invocation works against current dev DB**

Run: `pnpm exec tsx --env-file=.env.portf scripts/provision-portf-db.ts`
Expected stdout: `created portf database` (first run) OR `portf database already exists` (subsequent runs).

If the operator hasn't created `.env.portf` yet (per Task 1 Step 4), this fails with the explicit message. Surface that to the operator.

- [ ] **Step 6: Commit**

```bash
git add scripts/provision-portf-db.ts scripts/provision-portf-db.test.ts
git commit -m "feat(portf): idempotent provision:portf script for existing volumes"
```

---

## Task 5: Add `dev:portf` script to `apps/api`

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add the script**

Modify `apps/api/package.json`:

```diff
   "scripts": {
     "dev": "tsx watch --env-file=../../.env src/index.ts",
+    "dev:portf": "tsx watch --env-file=../../.env.portf src/index.ts",
     "start": "tsx --env-file=../../.env src/index.ts",
+    "start:portf": "tsx --env-file=../../.env.portf src/index.ts",
     "typecheck": "tsc --noEmit",
     "test": "vitest run"
   },
```

- [ ] **Step 2: Verify the script invocation parses (without binding the port)**

Run: `pnpm --filter @simlm/api exec tsx --env-file=../../.env.portf -e "import('@simlm/config').then(m => console.log(m.loadEnv().PORT))"`
Expected stdout: `3010`

If `.env.portf` doesn't exist locally, the env file load fails with a clear error. Surface to operator.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json
git commit -m "feat(portf): add dev:portf + start:portf scripts to apps/api"
```

---

## Task 6: Add `dev:portf` script to `apps/admin-api`

**Files:**
- Modify: `apps/admin-api/package.json`

- [ ] **Step 1: Add the script**

Modify `apps/admin-api/package.json` (mirror Task 5):

```diff
   "scripts": {
     "dev": "tsx watch --env-file=../../.env src/index.ts",
+    "dev:portf": "tsx watch --env-file=../../.env.portf src/index.ts",
     "start": "tsx --env-file=../../.env src/index.ts",
+    "start:portf": "tsx --env-file=../../.env.portf src/index.ts",
     "typecheck": "tsc --noEmit",
     "test": "vitest run"
   },
```

(If apps/admin-api's existing scripts differ from this shape, mirror their pattern — the rule is "same as the existing `dev`/`start` but `.env` → `.env.portf`". Read `apps/admin-api/package.json` first if uncertain.)

- [ ] **Step 2: Verify env load**

Run: `pnpm --filter @simlm/admin-api exec tsx --env-file=../../.env.portf -e "import('@simlm/config').then(m => console.log(m.loadEnv().ADMIN_PORT))"`
Expected stdout: `3011`

- [ ] **Step 3: Commit**

```bash
git add apps/admin-api/package.json
git commit -m "feat(portf): add dev:portf + start:portf scripts to apps/admin-api"
```

---

## Task 7: Add `dev:portf` task definition to turbo.json

**Files:**
- Modify: `turbo.json`

- [ ] **Step 1: Add the task**

Modify `turbo.json`:

```diff
 {
   "$schema": "https://turbo.build/schema.json",
   "tasks": {
     "dev": {
       "persistent": true,
       "cache": false
     },
+    "dev:portf": {
+      "persistent": true,
+      "cache": false
+    },
     "build": {
       "dependsOn": ["^build"],
       "outputs": ["dist/**"]
     },
     "typecheck": {
       "dependsOn": ["^build"]
     },
     "test": {
       "dependsOn": ["^build"],
       "outputs": ["coverage/**"]
     },
     "clean": {
       "cache": false
     }
   }
 }
```

`persistent: true` tells turbo this task runs indefinitely (dev server); `cache: false` disables output caching (irrelevant for long-running processes).

- [ ] **Step 2: Verify turbo picks up the task**

Run: `pnpm exec turbo run dev:portf --dry-run`
Expected: turbo reports `@simlm/api` and `@simlm/admin-api` as packages that would run `dev:portf`. Other packages without the script are skipped silently.

- [ ] **Step 3: Commit**

```bash
git add turbo.json
git commit -m "feat(portf): add dev:portf task definition to turbo.json"
```

---

## Task 8: Patch `apps/admin/vite.config.ts` for `VITE_ADMIN_API_TARGET`

**Files:**
- Modify: `apps/admin/vite.config.ts`

The admin SPA needs to point at either `:3001` (simlm admin-api) or `:3011` (portf admin-api) without code change. Env-var override at Vite startup is the lightest possible mechanism.

- [ ] **Step 1: Update the proxy target**

Modify `apps/admin/vite.config.ts`:

```diff
+const ADMIN_API_TARGET = process.env.VITE_ADMIN_API_TARGET ?? "http://127.0.0.1:3001";
+
 export default defineConfig({
   plugins: [react(), tailwindcss()],
   resolve: {
     alias: {
       "@": fileURLToPath(new URL("./src", import.meta.url)),
     },
   },
   server: {
     port: 5174,
     proxy: {
       "/api": {
-        target: "http://127.0.0.1:3001",
+        target: ADMIN_API_TARGET,
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/api/, ""),
       },
     },
   },
 });
```

Also append a sentence to the existing top-of-file comment block explaining the env knob — operator needs to discover it without reading git history.

- [ ] **Step 2: Update the docstring**

Insert after the existing comment's last paragraph (before `export default defineConfig`):

```ts
 * To manage the **portf** product's admin-api instead, launch with:
 *   VITE_ADMIN_API_TARGET=http://127.0.0.1:3011 pnpm --filter @simlm/admin dev
 * Both products are operator-trusted via loopback; same admin SPA, two targets.
```

- [ ] **Step 3: Verify dev server respects the override**

Run (in one terminal): `VITE_ADMIN_API_TARGET=http://127.0.0.1:3011 pnpm --filter @simlm/admin dev`
Then in another: `lsof -nP -iTCP:5174 -sTCP:LISTEN`
Expected: vite process listening on 5174. Don't need a real :3011 backend for this verification — Vite registers the proxy target lazily.

`Ctrl-C` the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/vite.config.ts
git commit -m "feat(portf): admin vite config reads VITE_ADMIN_API_TARGET env"
```

---

## Task 9: Rename root `dev` → `dev:simlm` (keep alias) + add portf scripts

**Files:**
- Modify: `package.json` (root)

This is the script-rename described in spec §4.4. `dev` stays as a one-release alias of `dev:simlm` so muscle memory and any local CI still work.

- [ ] **Step 1: Update root scripts**

Modify the root `package.json`:

```diff
   "scripts": {
-    "dev": "turbo run dev",
+    "dev": "pnpm dev:simlm",
+    "dev:simlm": "turbo run dev",
+    "dev:portf": "turbo run dev:portf",
     "dev:all": "if ! docker info > /dev/null 2>&1; then echo 'Docker daemon is not reachable. Start Docker Desktop (or colima/equivalent) and re-run pnpm dev:all.' >&2; exit 1; fi && pnpm db:up && pnpm migrate && pnpm dev",
     "build": "turbo run build",
     "lint": "oxlint",
     "typecheck": "turbo run typecheck",
     "test": "turbo run test",
     "format": "oxfmt --ignore-path .gitignore --ignore-path .oxfmtignore",
     "format:check": "oxfmt --check --ignore-path .gitignore --ignore-path .oxfmtignore",
     "clean": "turbo run clean && rm -rf node_modules .turbo",
     "db:up": "docker compose -f docker-compose.dev.yml up -d --wait postgres",
     "db:down": "docker compose -f docker-compose.dev.yml down",
     "db:reset": "docker compose -f docker-compose.dev.yml down -v && pnpm db:up",
-    "migrate": "pnpm --filter @simlm/db migrate up",
+    "migrate": "tsx --env-file=.env packages/db/src/migrate.ts up",
+    "migrate:portf": "tsx --env-file=.env.portf packages/db/src/migrate.ts up",
     "seed": "tsx --env-file=.env packages/db/src/scripts/seed.ts seeds/vi/*.yaml seeds/chatterbot/*.yml",
     "seed:vi": "tsx --env-file=.env packages/db/src/scripts/seed.ts seeds/vi/*.yaml --locale=vi",
-    "seed:chatterbot": "tsx --env-file=.env packages/db/src/scripts/seed.ts seeds/chatterbot/*.yml --locale=en"
+    "seed:chatterbot": "tsx --env-file=.env packages/db/src/scripts/seed.ts seeds/chatterbot/*.yml --locale=en",
+    "seed:portf": "tsx --env-file=.env.portf packages/db/src/scripts/seed.ts seeds/portf/*.yaml --locale=en",
+    "provision:portf": "tsx --env-file=.env.portf scripts/provision-portf-db.ts"
   },
```

Notes on each change:
- `dev` → alias of `dev:simlm` (one-release deprecation window; remove the alias when CI/docs are updated).
- `migrate` — drops `pnpm --filter @simlm/db migrate up` (which under the hood resolved to `tsx --env-file=../../.env src/migrate.ts up`). The new form invokes `tsx` directly from root. Behavior is identical because the migrate runner resolves `MIGRATIONS_DIR` file-relative (`new URL("../migrations", import.meta.url)`), not cwd-relative.
- `seed:portf` references `seeds/portf/*.yaml` which doesn't exist until Phase B. That's fine — the script will error with a glob mismatch if run before Phase B, which is correct behavior.
- `provision:portf` deliberately uses `--env-file=.env.portf` (not `.env`) so it reads `DATABASE_URL=postgres://…/portf`. The script then rewrites the path to `/postgres` for the maintenance connection (see Task 4's script).

- [ ] **Step 2: Verify `dev` still boots the simlm stack**

Run: `pnpm dev --dry-run` (turbo dry-run via the alias)
Expected: same output as `pnpm dev:simlm --dry-run` — both list `@simlm/api`, `@simlm/admin-api`, `@simlm/web`, `@simlm/admin` as `dev` task runners.

If turbo doesn't support `--dry-run` via the script alias, run `pnpm exec turbo run dev --dry-run` directly.

- [ ] **Step 3: Verify `migrate` works against simlm DB**

Run: `pnpm migrate`
Expected: prints `applied  …` or `skipped …` lines for each `001_extensions.sql` through `010_locales.sql`; exits 0.

If this is a fresh dev volume, all 10 migrations apply. If the existing simlm DB was already migrated, all 10 are `skipped`.

- [ ] **Step 4: Verify `migrate:portf` works against portf DB**

Run: `pnpm migrate:portf`
Expected: applies all 10 migrations against `portf` (this is the first time portf has been migrated). Exits 0.

Verify on the DB:
```bash
docker exec simlm-postgres psql -U postgres -d portf -c "SELECT filename FROM _migrations ORDER BY filename"
```
Expected: 10 rows, `001_extensions.sql` through `010_locales.sql`.

- [ ] **Step 5: Verify `provision:portf` is now idempotent against the live volume**

Run: `pnpm provision:portf`
Expected stdout: `portf database already exists` (since Task 3 or Task 4's test already created it). Exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "feat(portf): rename root dev→dev:simlm; add dev:portf, migrate:portf, seed:portf, provision:portf"
```

---

## Task 10: End-to-end smoke — `pnpm dev:portf` boots two backend instances

**Files:** none modified — pure verification.

- [ ] **Step 1: Start dev:portf and confirm both bind their ports**

Run (in one terminal): `pnpm dev:portf`
Expected stdout (interleaved):
- `api listening port=3010 hostname=0.0.0.0` (from `apps/api`'s log line in `src/index.ts`)
- `admin-api listening port=3011 hostname=127.0.0.1` (from `apps/admin-api`'s log line)

If either fails to bind because the simlm-instance port is squatting, that's a real conflict — diagnose. Otherwise, the simlm instance shouldn't be running for this smoke (different ports, so they'd coexist anyway).

- [ ] **Step 2: Curl portf api healthcheck**

In another terminal:

```bash
curl -s http://localhost:3010/healthz | jq .
```

Expected:
```json
{
  "ok": true,
  "db": "up",
  "db_latency_ms": 4,
  "uptime_s": 12
}
```

The `db: "up"` proves the api is connected to the `portf` database (its `loadEnv()` read `.env.portf`'s `DATABASE_URL`).

- [ ] **Step 3: Curl portf admin-api healthcheck (loopback only)**

```bash
curl -s http://127.0.0.1:3011/healthz | jq .
```

Expected: same shape, `ok: true`. If you replaced `127.0.0.1` with `localhost` it should also work (both resolve to the same loopback address).

- [ ] **Step 4: Confirm /chat returns the canonical fallback against an empty portf DB**

```bash
curl -sN -X POST http://localhost:3010/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello"}' | head -20
```

Expected: SSE stream. The matcher finds nothing (portf has no pairs yet), so the assistant reply comes from the `app_config.fallback_message_en` row that migration 010 seeded. The token stream ends with `data: [DONE]\n\n`.

If `fallback_message_en` doesn't exist in the portf DB, the api falls back further down the chain to `env.FALLBACK_MESSAGE` (still defined in `.env.portf` since we kept the var for schema compatibility). That's acceptable for now; Phase B replaces it with portfolio-specific seed copy.

- [ ] **Step 5: `Ctrl-C` the dev:portf process**

Both `tsx watch` instances should clean up cleanly. If either leaves a port bound, that's a regression worth investigating (`.unref()` on intervals in apps/api should make this work — but verify).

```bash
lsof -nP -iTCP:3010 -sTCP:LISTEN  # expect empty
lsof -nP -iTCP:3011 -sTCP:LISTEN  # expect empty
```

- [ ] **Step 6: No commit — this is verification only**

If anything failed, fix it in a follow-up commit and re-run Steps 1–5.

---

## Task 11: LTS dep audit — produce `docs/dep-audit-2026-05-26.md`

**Files:**
- Create: `docs/dep-audit-2026-05-26.md`

Per spec §11's Phase A detail and the user's standing rule (LTS-stable majors, caret ranges only, embargo preserved): walk every `package.json` in `apps/*` + `packages/*` + root and produce a per-workspace table of dep status.

> ⚠️ This task is research + writing. It does NOT bump versions. Any recommended bumps land as a separate PR-equivalent commit cluster (or a separate phase) only after operator sign-off.

- [ ] **Step 1: Enumerate all package.json files**

Run: `find . -name package.json -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.turbo/*' | sort`
Expected: ~14 results (root + 4 apps + 9 packages).

- [ ] **Step 2: For each dep, look up the latest LTS version**

For each unique dep across all package.jsons, run:

```bash
pnpm view <dep-name> dist-tags
```

The `latest` tag is what mainstream installs get; the `lts` tag (if present) is the explicit LTS. Compare both against the workspace's current caret range:

- If workspace declares `^X.Y.Z` and `latest` is in the same major X (e.g., `^X.Y.Z2`), action = `keep` (caret already picks up minor/patch).
- If `latest` is a higher major and that major has been published >2 weeks (mainstream-stable per user rule), action = `bump in a follow-up phase` (don't entangle with Phase A landing).
- If `latest` is a higher major published <2 weeks, action = `keep — embargo` (`pnpm-workspace.yaml`'s `minimumReleaseAge=10080` will block it anyway).
- If a dep has an explicit `lts` tag and current is below it, action = `bump in a follow-up phase` (LTS is the floor).

- [ ] **Step 3: Author the report**

Create `docs/dep-audit-2026-05-26.md`. Structure:

```markdown
# Dependency audit — 2026-05-26

**Standing rule** (from operator memory): LTS-stable majors only; caret
ranges; verify mainstream-stable before bumping; `pnpm-workspace.yaml`'s
`minimumReleaseAge=10080` (7 days) is the floor — bleeding-edge majors
auto-blocked.

## Summary

- Total workspaces audited: N
- Total unique deps: N
- **Action breakdown:**
  - `keep` (already at LTS major): N
  - `bump in follow-up phase` (LTS major behind): N
  - `keep — embargo` (latest <7 days old, blocked): N
  - `pin reason: <…>` (deliberate non-bump, documented): N

## Recommended bumps (require operator sign-off before landing)

| Workspace | Dep | Current | Latest LTS | Why bump now | Risk |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

## Per-workspace tables

### root package.json

| Dep | Current | Latest | Latest LTS | Action |
|---|---|---|---|---|
| oxfmt | ^0.47.0 | … | … | … |
| oxlint | ^1.0.0 | … | … | … |
| tsx | ^4.19.0 | … | … | … |
| turbo | ^2.3.0 | … | … | … |
| typescript | ^5.7.0 | … | … | … |

### apps/api/package.json

… (one section per workspace)

### packages/db/package.json

…

## New deps introduced in Phase A (none — Phase A is config-only)

Phase A adds no new runtime deps. The first new deps land in Phase C
(apps/portf scaffold): `@tanstack/react-router`, `@tanstack/router-plugin`,
`@mdx-js/rollup`, `@mdx-js/react`, `gray-matter`, `uuid`. Each will be
checked against this rule when Phase C's plan is written.
```

Populate the tables by running `pnpm view <dep> dist-tags` and `pnpm view <dep> versions --json | jq` for each unique dep. Do not skip deps — every workspace's deps + devDeps.

Common pre-filled rows (these are stable observations; the agent should still verify by running `pnpm view`):

- `react ^19.0.0` → `latest 19.x.y` → action `keep`
- `typescript ^5.7.0` → check if 5.8 LTS-stable
- `vite ^6.0.0` → check if 7.x is mainstream
- `vitest ^3.0.0` → check 3.x
- `tailwindcss ^4.0.0` → check 4.x

- [ ] **Step 4: Surface recommended bumps to the operator**

In the task summary, list every row in the "Recommended bumps" section. The operator decides which to land (separate commit cluster) and which to defer.

- [ ] **Step 5: Commit the report**

```bash
git add docs/dep-audit-2026-05-26.md
git commit -m "docs: LTS dep audit (phase A) — see file for recommendations"
```

---

## Task 12: Update CLAUDE.note.md with Phase A discoveries

**Files:**
- Modify: `CLAUDE.note.md`

Append observations worth capturing for the future CLAUDE.md curation pass. Per spec §13: do NOT edit CLAUDE.md directly.

- [ ] **Step 1: Append the Phase A section**

Append to `CLAUDE.note.md`:

```markdown
## Phase A — workspace plumbing (landed 2026-05-26)

- **`.env.portf` is the single source of truth for the second product's
  config.** Both `apps/api` and `apps/admin-api` have a `dev:portf`
  script that loads it (via `tsx --env-file=../../.env.portf`). Never
  create a third env file or in-process multi-tenancy router — the
  contract is: one env file → one set of process-instances.

- **`db/init/01_portf.sql` only runs on fresh container volumes.**
  Postgres' `/docker-entrypoint-initdb.d/` runs once per volume init. For
  existing dev volumes, use `pnpm provision:portf` — it connects to the
  `postgres` maintenance DB and idempotently `CREATE DATABASE portf`s.
  This is why we keep both: docker init for clean setups, the script for
  upgrade-in-place.

- **Root `migrate` script no longer uses `pnpm --filter @simlm/db`.**
  Direct `tsx --env-file=.env packages/db/src/migrate.ts up` works because
  the runner resolves `MIGRATIONS_DIR` file-relative via
  `new URL("../migrations", import.meta.url)`, not cwd-relative. If a
  contributor refactors the migrate runner to be cwd-aware, the root
  script breaks — keep the file-relative resolution.

- **`dev:simlm` and `dev:portf` are siblings; `dev` is a deprecated
  alias of `dev:simlm`.** Drop the alias when CI + docs no longer
  reference plain `dev`. There is no `dev:all` (deliberate — two product
  stacks in one terminal is too noisy; run each in its own).

- **`apps/admin`'s Vite proxy now reads `VITE_ADMIN_API_TARGET`.**
  Default unchanged (`http://127.0.0.1:3001` = simlm admin-api). Set to
  `http://127.0.0.1:3011` at launch to manage the portf product instead.
  One SPA, two targets — operator switches sessions. Adding application-
  layer auth here would imply external exposure is safe (it isn't); the
  loopback boundary is the security model. Same rule as the existing
  admin-api binding.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.note.md
git commit -m "docs(portf): capture phase A discoveries in CLAUDE.note.md"
```

---

## Task 13: Phase A wrap-up — checklist for the operator

- [ ] **Step 1: Verify the full phase landed**

Run from repo root:

```bash
# Files that should exist:
ls .env.portf.example db/init/01_portf.sql scripts/provision-portf-db.ts scripts/provision-portf-db.test.ts docs/dep-audit-2026-05-26.md
# Should list 5 files, all present.

# .env.portf should be gitignored (and may or may not exist locally):
git check-ignore .env.portf  # exit 0 means ignored

# Root scripts present:
node -e "const p = require('./package.json'); ['dev:simlm','dev:portf','migrate','migrate:portf','seed:portf','provision:portf'].forEach(s => console.log(s, JSON.stringify(p.scripts[s])))"
# Should print 6 lines, all non-undefined.

# Per-app scripts present:
node -e "const p = require('./apps/api/package.json'); console.log('api dev:portf', JSON.stringify(p.scripts['dev:portf']))"
node -e "const p = require('./apps/admin-api/package.json'); console.log('admin-api dev:portf', JSON.stringify(p.scripts['dev:portf']))"
# Both should print a tsx watch command.

# turbo.json has the task:
node -e "const t = require('./turbo.json'); console.log('dev:portf task', JSON.stringify(t.tasks['dev:portf']))"
# Should print { persistent: true, cache: false }.

# Admin vite config has the env knob:
grep -q "VITE_ADMIN_API_TARGET" apps/admin/vite.config.ts && echo "admin env knob: OK"
```

If anything is missing, jump back to the relevant task and complete it.

- [ ] **Step 2: Run the test suite to confirm nothing regressed**

Run: `pnpm --workspace-concurrency=1 test`
Expected: All existing tests pass plus the new `scripts/provision-portf-db.test.ts`. The serial flag is mandatory because DB-touching suites share the `simlm_test` database (existing rule from CLAUDE.md).

- [ ] **Step 3: Summarize for the operator**

Output a final summary covering:
- Files created/modified count
- The 3 commands the operator should know:
  - `pnpm migrate:portf` — apply migrations to portf DB
  - `pnpm dev:portf` — boot api (3010) + admin-api (3011) against portf DB
  - `VITE_ADMIN_API_TARGET=http://127.0.0.1:3011 pnpm --filter @simlm/admin dev` — manage portf via admin SPA
- The dep audit report's "Recommended bumps" section — list each row so the operator can decide which to land separately
- Confirmation that Phase B (portf seeds + first matcher hit) is ready to plan

---

## Self-review log (writing-plans skill)

1. **Spec coverage** — Phase A deliverables (spec §12):
   - ✅ `.env.portf` → Task 1
   - ✅ docker init → Task 2 (verified Task 3)
   - ✅ root scripts incl. `dev` → `dev:simlm` rename + `dev:portf` → Task 9
   - ✅ per-app `dev:portf` scripts → Tasks 5, 6
   - ✅ `provision:portf` one-shot → Task 4 (with idempotency test)
   - ✅ `turbo.json` task def → Task 7
   - ✅ admin `VITE_ADMIN_API_TARGET` patch → Task 8
   - ✅ dep audit report → Task 11

2. **Placeholder scan** — clean. No TBD, no "implement later", no "similar to Task N", no "add appropriate error handling". Every code block contains the actual content; every command shows expected output.

3. **Type consistency** — `provisionPortfDb` is the only cross-task symbol: defined in Task 4 Step 3, referenced in Task 4 Step 1 (test) and Task 4 Step 4. Signature matches.

4. **One pre-emptive correction** — Task 4 Step 5's verification calls `pnpm exec tsx --env-file=.env.portf ...`. This requires the operator to have already created `.env.portf` from the template (Task 1 Step 4 surfaces this). If they haven't, the script prints the clear error and exits 2. The plan doesn't auto-create `.env.portf` because uncommitted-but-required local config is the operator's responsibility (mirrors the existing `.env` pattern).
