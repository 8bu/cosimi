import { loadEnv } from "@cosimi/core";
import { sql } from "@cosimi/db";

import { log } from "./logger";

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Delete expired rows from `sessions` and `session_teaches`. Both tables
 * carry an indexed `expires_at` column; the DELETE walks the partial range
 * `expires_at < NOW()`, so the cost is proportional to the expired set,
 * not the live one.
 */
export async function sweepOnce(): Promise<{ sessions: number; teaches: number }> {
  const [sessR, teachR] = await Promise.all([
    sql()`DELETE FROM sessions        WHERE expires_at < NOW()`,
    sql()`DELETE FROM session_teaches WHERE expires_at < NOW()`,
  ]);
  return { sessions: sessR.count, teaches: teachR.count };
}

export function startGc(): void {
  if (timer) return;
  const env = loadEnv();
  timer = setInterval(async () => {
    try {
      const { sessions, teaches } = await sweepOnce();
      // Zero-row sweeps stay silent — log noise discipline.
      if (sessions + teaches > 0) {
        log.info({ sessions, teaches }, "gc.sweep");
      }
    } catch (err) {
      log.error({ err }, "gc.sweep.failed");
    }
  }, env.GC_INTERVAL_MS);
  // Without unref, the active interval would block process exit even after
  // server.close() resolves. stopGc() is the orderly path; unref is the
  // safety net for abnormal exits. Workers timers lack .unref() — guard it.
  if (typeof timer.unref === "function") timer.unref();
}

export function stopGc(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
