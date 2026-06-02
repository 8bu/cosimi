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

// CLI entrypoint: tsx packages/adapter-postgres/src/scripts/provision-portf-db.ts
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
  // Using new URL() handles edge cases (no path, query strings, IPv6) cleanly
  // and avoids the regex anchor ambiguity in the prior implementation.
  const u = new URL(portfUrl);
  u.pathname = "/postgres";
  const maintenanceUrl = u.toString();

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
