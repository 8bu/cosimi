import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type postgres from "postgres";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * List migration filenames (`*.sql`) in `dir`, lexicographic order. Numbered,
 * additive, never rewritten after merge.
 */
export async function listMigrationFiles(dir: string = MIGRATIONS_DIR): Promise<string[]> {
  const entries = await readdir(dir);
  return entries.filter((f) => f.endsWith(".sql")).toSorted();
}

/**
 * Apply every migration file, in order, against `db`. No tracking table — the
 * caller is expected to have a clean schema (vitest global-setups DROP `public`
 * first). For incremental, tracked application use the `migrate` CLI.
 *
 * The full schema — including the pgvector graph/retrieval tables — is one
 * sequence: retrieve() is the SDK's core, so every target gets it (Neon, the
 * dev container, and the test image all have the `vector` extension). The SQL is
 * `IF NOT EXISTS`, so re-running is safe. Extracted here so the vitest
 * global-setups stop inlining the loop (the CLAUDE.md "fourth call site").
 */
export async function applyMigrations(
  db: ReturnType<typeof postgres>,
  dir: string = MIGRATIONS_DIR,
): Promise<void> {
  const files = await listMigrationFiles(dir);
  for (const f of files) {
    await db.file(`${dir}/${f}`);
  }
}
