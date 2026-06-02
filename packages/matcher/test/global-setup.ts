import postgres from "postgres";
import { applyMigrations } from "@cosimi/db-core";

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
    await applyMigrations(db);
  } finally {
    await db.end();
  }

  // 3) Pin DATABASE_URL for the test workers. Vitest spawns its pool after
  //    globalSetup returns, so worker threads inherit this value.
  process.env.DATABASE_URL = testUrl;
}
