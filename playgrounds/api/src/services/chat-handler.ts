import { normalize } from "@cosimi/normalizer";
import { sql } from "@cosimi/adapter-postgres";
import { loadEnv, type Env } from "@cosimi/core";

import type { Emitter } from "../lib/sse";
import { handleTeach, TeachError } from "./teach-handler";
import { parseTeachCommand, looksLikeTeach } from "./teach-parser";
import { log } from "../lib/logger";

export interface RunChatArgs {
  sessionId: string;
  message: string;
  emit: Emitter;
  // Ordered locale preference for the matcher. Defaults to ['und'] when
  // the client omits it (legacy callers, tests that don't care).
  locales?: string[];
  // Locale to stamp on any /teach in this turn. Defaults to locales[0]
  // (the primary) when omitted; falls through to 'und' if neither is set.
  locale?: string;
}

/**
 * Orchestrate one /chat turn over an SSE emitter.
 *
 * Branches:
 *   - `/teach …` command → parse + handleTeach + emit teach_ack
 *   - regular message    → no_match stub (P1b) + unanswered log
 *
 * Persistence side-effects:
 *   - sessions upsert     — always (records last_input + last_pair_id)
 *   - unanswered upsert   — only on no_match
 *
 * Errors from teach are emitted as SSE `error` events with a safe
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

function resolveTeachLocale(args: RunChatArgs): string {
  // Explicit body.locale wins (admin/automation can pin a teach to a
  // specific locale regardless of the primary). Otherwise derive from
  // locales[0] — that's the UI's current primary — and finally 'und'.
  return args.locale ?? args.locales?.[0] ?? "und";
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
      locale: resolveTeachLocale(args),
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

/**
 * Regular (non-teach) message branch.
 *
 * P1b: the lexical match cascade is gone (`cosimi.match` deleted). Runtime
 * GraphRAG retrieval (`cosimi.retrieve`) needs an embedder, wired in P2. Until
 * then this branch always reports no_match and logs the input to `unanswered`,
 * preserving the SSE contract (session → no_match → [DONE]) and leaving the
 * `/teach` branch and `sessions.last_input` follow-up flow intact.
 */
async function runMatchBranch(args: RunChatArgs, env: Env): Promise<void> {
  const normalized = normalize(args.message);

  // sessions upsert — records last_input so a following `/teach <reply>` works.
  await sql()`
    INSERT INTO sessions (
      session_id, last_input, last_input_normalized, last_pair_id, expires_at
    ) VALUES (
      ${args.sessionId}::uuid,
      ${args.message},
      ${normalized},
      NULL,
      NOW() + (${env.SESSION_TTL_HOURS} * INTERVAL '1 hour')
    )
    ON CONFLICT (session_id) DO UPDATE SET
      last_input            = EXCLUDED.last_input,
      last_input_normalized = EXCLUDED.last_input_normalized,
      last_pair_id          = EXCLUDED.last_pair_id,
      expires_at            = EXCLUDED.expires_at,
      updated_at            = NOW()
  `;

  // Log the miss for admin review; idempotent on repeats.
  await sql()`
    INSERT INTO unanswered (input, normalized_input, source, count, last_seen)
    VALUES (${args.message}, ${normalized}, 'chat', 1, NOW())
    ON CONFLICT (normalized_input) DO UPDATE SET
      count     = unanswered.count + 1,
      last_seen = NOW()
  `;
  await args.emit({ type: "no_match" });
}

function serializeErr(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  return { message: String(err) };
}
