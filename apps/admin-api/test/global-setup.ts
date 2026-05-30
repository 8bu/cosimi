import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

// Reuse the same `cosimi_test` database that @cosimi/matcher and @cosimi/api
// tests use. The migration loop is inlined here (mirrors apps/api and
// packages/matcher's global setup) because @cosimi/db doesn't export an
// `applyMigrations()` helper. If a fourth caller appears, refactor.
const MIGRATIONS_DIR = fileURLToPath(new URL("../../../packages/db/migrations", import.meta.url));

function deriveUrls(): { test: string; admin: string } {
  const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cosimi";
  const test = new URL(base);
  test.pathname = "/cosimi_test";
  const admin = new URL(base);
  admin.pathname = "/postgres";
  return { test: test.toString(), admin: admin.toString() };
}

export default async function setup(): Promise<void> {
  const { test: testUrl, admin: adminUrl } = deriveUrls();

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

  process.env.DATABASE_URL = testUrl;
}
