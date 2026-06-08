import postgres from "postgres";

/**
 * CLI: emit the row count of `pairs` (active only — `deleted_at IS NULL`)
 * to stdout. Exit non-zero only on DB connection / query failure.
 *
 * Usage:
 *   tsx --env-file=.env packages/adapter-postgres/src/scripts/pairs-count.ts
 *
 * Counts active rows so a soft-deleted corpus still reads as non-empty
 * (a re-seed on top of soft-deletes is the recovery path anyway).
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set — pass --env-file=.env");
    process.exit(2);
  }
  const sql = postgres(url);
  try {
    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM pairs WHERE deleted_at IS NULL
    `;
    process.stdout.write(rows[0]?.count ?? "0");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
