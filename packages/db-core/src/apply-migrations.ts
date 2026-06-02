import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type postgres from "postgres";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * List migration filenames (`*.sql`) in lexicographic order.
 * Numbered, additive, never rewritten after merge.
 */
export async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith(".sql")).toSorted();
}

/**
 * Apply every migration file, in order, against `db`. No tracking table — the
 * caller is expected to have a clean schema (vitest global-setups DROP `public`
 * first). For incremental, tracked application use the `migrate` CLI (`up`).
 *
 * Extracted here so the three vitest global-setups (matcher, api, admin-api)
 * stop inlining the loop (the CLAUDE.md "fourth call site" threshold).
 */
export async function applyMigrations(db: ReturnType<typeof postgres>): Promise<void> {
  const files = await listMigrationFiles();
  for (const f of files) {
    await db.file(`${MIGRATIONS_DIR}/${f}`);
  }
}
