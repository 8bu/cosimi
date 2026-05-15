import { sql } from "@simlm/db";
import { normalize } from "@simlm/normalizer";
import { loadEnv } from "@simlm/config";

import { checkTeachRateLimit } from "./rate-limit";

export interface TeachOutcome {
  queue_id: number;
  flagged: boolean;
}

export interface TeachInput {
  sessionId: string;
  /** Explicit input; null → use sessions.last_input. */
  input: string | null;
  reply: string;
  topic?: string;
}

/**
 * User-visible teach failure. The chat handler matches on `instanceof
 * TeachError` to decide whether the SSE `error` message is safe to expose
 * (vs the generic "teach failed" for unexpected errors).
 */
export class TeachError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeachError";
  }
}

export async function handleTeach(args: TeachInput): Promise<TeachOutcome> {
  const env = loadEnv();

  // 1. Validate reply payload before any DB work.
  const reply = args.reply.trim();
  if (!reply) throw new TeachError("empty reply");
  if (reply.length > env.TEACH_MAX_LENGTH) {
    throw new TeachError(`reply too long (max ${env.TEACH_MAX_LENGTH} chars)`);
  }

  // 2. Rate-limit per session. Rewrap as TeachError so the user sees the
  //    message via SSE — checkTeachRateLimit throws plain Error to avoid
  //    a circular dep between rate-limit ↔ teach-handler.
  try {
    await checkTeachRateLimit(args.sessionId);
  } catch (err) {
    throw new TeachError(err instanceof Error ? err.message : "rate limit error");
  }

  // 3. Resolve input — explicit string or pull session.last_input.
  let input = args.input?.trim() || null;
  if (input === null) {
    const rows = await sql()<{ last_input: string | null }[]>`
      SELECT last_input FROM sessions WHERE session_id = ${args.sessionId}::uuid
    `;
    const lastInput = rows[0]?.last_input?.trim();
    if (!lastInput) {
      throw new TeachError(
        // intentionally chatty — this is the most common user-error path
        // and a terse "missing input" would confuse first-time users.
        'I don\'t know what to teach about — say something first, or use /teach "input" => "reply".',
      );
    }
    input = lastInput;
  }

  // 4. Flag check. Empty TEACH_BLOCKLIST_REGEX means "no blocklist".
  const flagged = isBlocklisted(reply, env.TEACH_BLOCKLIST_REGEX);

  // 5. Insert queue row + session cache atomically. The session cache is
  //    what the matcher's session_teach tier reads to serve this reply
  //    back to the same session for the next 10 minutes — without
  //    waiting for admin approval.
  const normalized_input = normalize(input);
  const ttl_minutes = env.SESSION_TEACH_TTL_MINUTES;

  // RETURNING id::int because teach_queue.id is BIGSERIAL → postgres.js
  // ships BIGINT as string by default. We coerce here so the SSE event's
  // queue_id is a real number (matches the ChatStreamEvent contract).
  const queueId = await sql().begin(async (tx) => {
    const queue = await tx<{ id: number }[]>`
      INSERT INTO teach_queue (
        input, normalized_input, response, topic,
        submitted_by_session, status, flagged
      ) VALUES (
        ${input}, ${normalized_input}, ${reply}, ${args.topic ?? null},
        ${args.sessionId}::uuid, 'pending', ${flagged}
      )
      RETURNING id::int AS id
    `;
    const id = queue[0]!.id;
    // integer * interval is well-typed in Postgres; the more obvious
    // (n || ' minutes')::interval would force a runtime cast we don't need.
    await tx`
      INSERT INTO session_teaches (
        session_id, normalized_input, response, teach_queue_id, expires_at
      ) VALUES (
        ${args.sessionId}::uuid, ${normalized_input}, ${reply}, ${id},
        NOW() + (${ttl_minutes} * INTERVAL '1 minute')
      )
    `;
    return id;
  });

  return { queue_id: queueId, flagged };
}

function isBlocklisted(reply: string, pattern: string): boolean {
  if (!pattern) return false;
  try {
    return new RegExp(pattern, "i").test(reply);
  } catch {
    // Bad regex in env — fail safe (don't flag) and log nothing here;
    // the env schema accepts any string, so config bugs surface at runtime.
    return false;
  }
}
