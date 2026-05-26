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
