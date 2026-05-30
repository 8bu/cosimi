import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

// Migrations live in @cosimi/db, but the package doesn't export an
// `applyMigrations()` function (migrate.ts is a CLI). We inline the loop
// here to keep Phase 4 from touching the Phase 2 package.
const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations", import.meta.url));

function deriveUrls(): { test: string; admin: string } {
  const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cosimi";
  const test = new URL(base);
  test.pathname = "/cosimi_test";
  const admin = new URL(base);
  admin.pathname = "/postgres";
  return { test: test.toString(), admin: admin.toString() };
}

export default async function setup() {
  const { test: testUrl, admin: adminUrl } = deriveUrls();

  // 1) Ensure the cosimi_test database exists. CREATE DATABASE can't run inside
  //    a transaction, so a separate single-connection client to the `postgres`
  //    maintenance DB does the check + create.
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const rows = await admin<{ exists: number }[]>`
      SELECT 1 AS exists FROM pg_database WHERE datname = 'cosimi_test'
    `;
    if (!rows.length) {
      await admin.unsafe("CREATE DATABASE cosimi_test");
    }
  } finally {
    await admin.end();
  }

  // 2) Reset schema in cosimi_test and apply all migrations from packages/db.
  const db = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    await db.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).toSorted();
    for (const f of files) {
      await db.file(`${MIGRATIONS_DIR}/${f}`);
    }
  } finally {
    await db.end();
  }

  // 3) Pin DATABASE_URL for the test workers. Vitest spawns its pool after
  //    globalSetup returns, so worker threads inherit this value.
  process.env.DATABASE_URL = testUrl;
}
