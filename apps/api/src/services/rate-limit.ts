import { sql } from "@simlm/db";
import { loadEnv } from "@simlm/config";

/**
 * The teach queue itself is the source of truth for rate limiting: count
 * how many rows this session inserted in the past hour. Cheap because
 * `teach_queue_session_idx` covers (submitted_by_session, created_at DESC).
 *
 * Throws a generic Error (caught upstream in the teach handler and
 * re-thrown as TeachError so the user sees the message via the SSE
 * `error` event).
 */
export async function checkTeachRateLimit(sessionId: string): Promise<void> {
  const env = loadEnv();
  const rows = await sql()<{ recent_count: number }[]>`
    SELECT count(*)::int AS recent_count
    FROM teach_queue
    WHERE submitted_by_session = ${sessionId}::uuid
      AND created_at > NOW() - INTERVAL '1 hour'
  `;
  const recent = rows[0]?.recent_count ?? 0;
  if (recent >= env.TEACH_RATE_LIMIT_PER_HOUR) {
    throw new Error(`teach rate limit exceeded (${env.TEACH_RATE_LIMIT_PER_HOUR}/hour)`);
  }
}
