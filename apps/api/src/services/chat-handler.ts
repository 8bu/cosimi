import { match } from "@simlm/matcher";
import { normalize } from "@simlm/normalizer";
import { sql } from "@simlm/db";
import { loadEnv, type Env } from "@simlm/config";

import type { Emitter } from "../lib/sse";
import { tokenize, jitterMs, sleep } from "../lib/tokenizer";
import { handleTeach, TeachError } from "./teach-handler";
import { parseTeachCommand, looksLikeTeach } from "./teach-parser";
import { log } from "../lib/logger";

export interface RunChatArgs {
  sessionId: string;
  message: string;
  emit: Emitter;
}

/**
 * Orchestrate one /chat turn over an SSE emitter.
 *
 * Branches:
 *   - `/teach …` command → parse + handleTeach + emit teach_ack
 *   - regular message    → match → metadata + token stream OR no_match + fallback
 *
 * Persistence side-effects:
 *   - sessions upsert     — always (records last_input + last_pair_id)
 *   - unanswered upsert   — only on no_match
 *
 * Errors from match/teach are emitted as SSE `error` events with a safe
 * message (TeachError messages are user-visible; everything else maps to
 * "internal error"). The pino logger carries the full diagnostic detail.
 */
export async function runChat(args: RunChatArgs): Promise<void> {
  const env = loadEnv();
  await args.emit({ type: "session", session_id: args.sessionId });

  if (looksLikeTeach(args.message)) {
    await runTeachBranch(args, env);
    return;
  }

  await runMatchBranch(args, env);
}

async function runTeachBranch(args: RunChatArgs, _env: Env): Promise<void> {
  const parsed = parseTeachCommand(args.message);
  if (!parsed.ok) {
    await args.emit({ type: "error", message: parsed.error });
    return;
  }
  try {
    const outcome = await handleTeach({
      sessionId: args.sessionId,
      input: parsed.input,
      reply: parsed.reply,
    });
    await args.emit({ type: "teach_ack", queue_id: outcome.queue_id });
  } catch (err) {
    if (err instanceof TeachError) {
      await args.emit({ type: "error", message: err.message });
    } else {
      log.error({ err: serializeErr(err) }, "teach handler failed");
      await args.emit({ type: "error", message: "teach failed" });
    }
  }
}

async function runMatchBranch(args: RunChatArgs, env: Env): Promise<void> {
  const normalized = normalize(args.message);
  const result = await match({
    normalizedInput: normalized,
    sessionId: args.sessionId,
  });

  // Sessions upsert happens regardless of match outcome — even a miss
  // updates last_input so a following `/teach <reply>` can pick it up.
  await sql()`
    INSERT INTO sessions (
      session_id, last_input, last_input_normalized, last_pair_id, expires_at
    ) VALUES (
      ${args.sessionId}::uuid,
      ${args.message},
      ${normalized},
      ${result?.pairId ?? null},
      NOW() + (${env.SESSION_TTL_HOURS} * INTERVAL '1 hour')
    )
    ON CONFLICT (session_id) DO UPDATE SET
      last_input            = EXCLUDED.last_input,
      last_input_normalized = EXCLUDED.last_input_normalized,
      last_pair_id          = EXCLUDED.last_pair_id,
      expires_at            = EXCLUDED.expires_at,
      updated_at            = NOW()
  `;

  if (result) {
    await args.emit({
      type: "metadata",
      tier: result.tier,
      confidence: result.confidence,
      pairId: result.pairId,
      lowConfidence: result.lowConfidence,
    });
    await streamTokens(result.response, args.emit, env);
    return;
  }

  // No match: log to `unanswered` for admin review, emit no_match,
  // then stream the fallback so the UX still feels responsive.
  await sql()`
    INSERT INTO unanswered (input, normalized_input, source, count, last_seen)
    VALUES (${args.message}, ${normalized}, 'chat', 1, NOW())
    ON CONFLICT (normalized_input) DO UPDATE SET
      count     = unanswered.count + 1,
      last_seen = NOW()
  `;
  await args.emit({ type: "no_match" });
  await streamTokens(env.FALLBACK_MESSAGE, args.emit, env);
}

async function streamTokens(text: string, emit: Emitter, env: Env): Promise<void> {
  for (const tok of tokenize(text, env.SSE_DELAY_MODE)) {
    const delay = jitterMs(env.SSE_DELAY_BASE_MS, env.SSE_DELAY_JITTER_MS);
    if (delay > 0) await sleep(delay);
    await emit({ type: "token", content: tok });
  }
}

function serializeErr(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  return { message: String(err) };
}
