export type Source = "seed" | "user" | "chat" | "llm";
export type MatchTier = "session_teach" | "exact" | "fts" | "trigram";

export interface MatchResult {
  response: string;
  tier: MatchTier;
  confidence: number;
  pairId: number | null;
  // `pairs.score` (vote tally — INTEGER, can be negative). null for the
  // session_teach tier (no underlying pair), populated for exact/fts/trigram.
  score: number | null;
  lowConfidence: boolean;
  // The locale actually carried by the matched row (BCP-47, with 'und'
  // for universal). Distinct from the *requested* primary locale: a Vi
  // request that falls through to an 'und' row reports locale='und'
  // here, which is what the UI badge surfaces (gated by
  // EXPOSE_MATCH_INSIGHTS like tier/confidence/score).
  locale: string;
  // Operator-assigned topic slug on the matched pair (e.g.
  // "portfolio/artifact/wegopro"). null for session_teach tier (no
  // underlying pair) and for pairs without a topic. Used by portf's
  // matchArtifact as an unambiguous discriminator ahead of matchPatterns.
  topic: string | null;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  // Ordered locale preference. The matcher tries each in turn (full
  // session_teach→exact→fts→trigram cascade per locale) and returns the
  // first hit. 'und'-tagged rows match alongside the requested locale.
  // Missing → defaults to ['und']; a single value like ['vi'] sets primary
  // with no fallback beyond the implicit 'und' overlap inside each tier.
  locales?: string[];
  // Locale to stamp on any /teach in this turn. The chat composer's
  // current primary locale (set client-side). Distinct from locales[0]
  // because admin tooling may want to teach in a locale that isn't the
  // primary read locale. When omitted, the server derives from locales[0].
  locale?: string;
}

/**
 * Events streamed over POST /chat as SSE.
 *
 *  - session    — emitted first; carries the server-resolved session_id
 *  - metadata   — emitted when the matcher returned a hit; carries tier + confidence.
 *                 lowConfidence flags borderline (trigram) hits so the UI can show
 *                 the "Teach a better reply" CTA.
 *  - no_match   — emitted when the matcher returned null; the fallback message is
 *                 then streamed as token events. Distinct from low-confidence so the
 *                 client can discriminate "fuzzy hit" from "no hit at all."
 *  - token      — one chunk of the response body, paced by SSE_DELAY_*.
 *  - teach_ack  — emitted in the /teach branch after the queue insert succeeds.
 *  - done       — final event; terminator [DONE] follows.
 *  - error      — emitted on any handler failure; generic message (details in logs).
 */
export type ChatStreamEvent =
  | { type: "session"; session_id: string }
  | {
      // tier/confidence/score are nullable on the wire when the server is
      // configured to hide match insights (EXPOSE_MATCH_INSIGHTS=false in
      // @cosimi/core — the production default). pairId and lowConfidence
      // always ship because voting and the "low confidence" / "no match"
      // CTAs depend on them.
      type: "metadata";
      tier: MatchTier | null;
      confidence: number | null;
      pairId: number | null;
      score: number | null;
      lowConfidence: boolean;
      // BCP-47 code of the matched row. Null on the wire when
      // EXPOSE_MATCH_INSIGHTS=false (same gating as tier/confidence/score).
      locale: string | null;
      // Operator-assigned topic slug. Null when EXPOSE_MATCH_INSIGHTS=false
      // (gated alongside tier/confidence/score/locale) or when the matched
      // pair carries no topic.
      topic: string | null;
    }
  | { type: "no_match" }
  | { type: "token"; content: string }
  | { type: "teach_ack"; queue_id: number }
  | { type: "done" }
  | { type: "error"; message: string };

export interface TeachRequest {
  reply: string;
  input?: string;
  topic?: string;
  session_id?: string;
  // Locale of the new pair. Missing → 'und'. The chat composer sends the
  // current UI primary locale; admin tools can pick freely.
  locale?: string;
}

export interface FeedbackRequest {
  pair_id: number;
  value: 1 | -1;
  session_id?: string;
}

export interface FeedbackResponse {
  pair_id: number;
  new_score: number;
  was_pruned: boolean;
}

export interface StatsResponse {
  total_pairs_learned: number;
}

export interface HealthResponse {
  ok: boolean;
  db: "up" | "down";
  db_latency_ms: number | null;
  uptime_s: number;
}

export interface AdminPair {
  id: number;
  input: string;
  normalized_input: string;
  response: string;
  score: number;
  source: Source;
  topic: string | null;
  batch_id: number | null;
  flagged: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUnanswered {
  id: number;
  input: string;
  normalized_input: string;
  source: "chat" | "llm";
  count: number;
  last_seen: string;
}

export interface AdminTeachQueueItem {
  id: number;
  input: string;
  response: string;
  topic: string | null;
  submitted_by_session: string;
  status: "pending" | "approved" | "rejected";
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}
