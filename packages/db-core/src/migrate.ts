import postgres from "postgres";
import { loadEnv } from "@cosimi/core";

import { listMigrationFiles, MIGRATIONS_DIR } from "./apply-migrations";

type Subcommand = "up" | "status" | "reset";
type Sql = ReturnType<typeof postgres>;

// Standalone CLI client. db-core stays driver-agnostic at runtime — only this
// CLI (and apply-migrations' type import) touches `postgres`, declared a
// peerDependency. The adapter packages own the request-scoped/pooled clients.
function createClient(): Sql {
  const env = loadEnv();
  return postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
}

async function ensureTrackingTable(db: Sql) {
  await db`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getApplied(db: Sql): Promise<Set<string>> {
  const rows = await db<{ filename: string }[]>`SELECT filename FROM _migrations`;
  return new Set(rows.map((r) => r.filename));
}

async function runUp(db: Sql): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureTrackingTable(db);
  const all = await listMigrationFiles();
  const already = await getApplied(db);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filename of all) {
    if (already.has(filename)) {
      skipped.push(filename);
      continue;
    }
    const path = `${MIGRATIONS_DIR}/${filename}`;
    try {
      await db.begin(async (tx) => {
        await tx.file(path);
        await tx`INSERT INTO _migrations (filename) VALUES (${filename})`;
      });
      applied.push(filename);
      console.log(`applied  ${filename}`);
    } catch (err) {
      console.error(`failed   ${filename}`);
      throw err;
    }
  }
  return { applied, skipped };
}

async function runStatus(db: Sql): Promise<number> {
  await ensureTrackingTable(db);
  const all = await listMigrationFiles();
  const already = await getApplied(db);
  const pending: string[] = [];

  for (const filename of all) {
    if (already.has(filename)) {
      console.log(`applied  ${filename}`);
    } else {
      console.log(`pending  ${filename}`);
      pending.push(filename);
    }
  }
  console.log(`\n${all.length - pending.length} applied / ${pending.length} pending`);
  return pending.length === 0 ? 0 : 1;
}

async function runReset(db: Sql) {
  const env = loadEnv();
  if (env.NODE_ENV === "production") {
    throw new Error("reset refused: NODE_ENV=production");
  }
  console.log("dropping schema public ...");
  await db.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("re-applying migrations ...");
  await runUp(db);
}

async function main() {
  const cmd = process.argv[2] as Subcommand | undefined;
  if (cmd !== "up" && cmd !== "status" && cmd !== "reset") {
    console.error("usage: pnpm migrate <up|status|reset>");
    process.exit(2);
  }

  const db = createClient();
  try {
    if (cmd === "up") {
      const { applied, skipped } = await runUp(db);
      console.log(`\n${applied.length} applied, ${skipped.length} already up-to-date`);
      process.exit(0);
    }
    if (cmd === "status") {
      const code = await runStatus(db);
      process.exit(code);
    }
    if (cmd === "reset") {
      await runReset(db);
      process.exit(0);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

await main();
