import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "@cosimi/core";
import { sql, closeDb } from "#client";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

type Subcommand = "up" | "status" | "reset";

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith(".sql")).toSorted();
}

async function ensureTrackingTable() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getApplied(): Promise<Set<string>> {
  const db = sql();
  const rows = await db<{ filename: string }[]>`
    SELECT filename FROM _migrations
  `;
  return new Set(rows.map((r) => r.filename));
}

async function runUp(): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureTrackingTable();
  const db = sql();
  const all = await listMigrationFiles();
  const already = await getApplied();
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

async function runStatus(): Promise<number> {
  await ensureTrackingTable();
  const all = await listMigrationFiles();
  const already = await getApplied();
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

async function runReset() {
  const env = loadEnv();
  if (env.NODE_ENV === "production") {
    throw new Error("reset refused: NODE_ENV=production");
  }
  const db = sql();
  console.log("dropping schema public ...");
  await db.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("re-applying migrations ...");
  await runUp();
}

async function main() {
  const cmd = process.argv[2] as Subcommand | undefined;
  if (cmd !== "up" && cmd !== "status" && cmd !== "reset") {
    console.error("usage: pnpm migrate <up|status|reset>");
    process.exit(2);
  }

  try {
    if (cmd === "up") {
      const { applied, skipped } = await runUp();
      console.log(`\n${applied.length} applied, ${skipped.length} already up-to-date`);
      process.exit(0);
    }
    if (cmd === "status") {
      const code = await runStatus();
      process.exit(code);
    }
    if (cmd === "reset") {
      await runReset();
      process.exit(0);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

await main();
