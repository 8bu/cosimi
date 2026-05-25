import { sql } from "#client";

/**
 * Snapshot the entire app_config table as a flat key→value map. Called from
 * the chat handler on every request because the table is tiny (single-digit
 * rows expected) and Postgres caches it cleanly — the SELECT is sub-ms.
 *
 * No in-process cache: invalidation across operator-side `UPDATE app_config`
 * would need either a TTL (stale window) or a pub/sub fan-out (overkill at
 * this scale). Re-read every request is simpler and correct. Revisit only if
 * production load testing shows app_config queries dominating.
 */
export async function getAppConfig(): Promise<Record<string, string>> {
  const rows = await sql()<{ key: string; value: string }[]>`
    SELECT key, value FROM app_config
  `;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Upsert a single config key. Intended for an eventual admin endpoint;
 * exposed now so direct callers (scripts, tests) don't need raw SQL.
 */
export async function setAppConfig(key: string, value: string): Promise<void> {
  await sql()`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value      = EXCLUDED.value,
      updated_at = NOW()
  `;
}
