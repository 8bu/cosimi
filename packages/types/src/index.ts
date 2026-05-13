export type Source = "seed" | "user" | "chat" | "llm";
export type MatchTier = "session_teach" | "exact" | "fts" | "trigram";

export interface MatchResult {
  response: string;
  tier: MatchTier;
  confidence: number;
  pairId: number | null;
  lowConfidence: boolean;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
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
      type: "metadata";
      tier: MatchTier;
      confidence: number;
      pairId: number | null;
      lowConfidence: boolean;
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
}

export interface FeedbackRequest {
  pair_id: number;
  value: 1 | -1;
  session_id?: string;
}

export interface StatsResponse {
  total_pairs_learned: number;
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
