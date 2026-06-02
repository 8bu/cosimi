import type { MatchTier } from "@cosimi/core";

// UI message types — intentionally distinct from @cosimi/core' ChatStreamEvent.
// SSE events drive transitions; these are the settled state the view renders.
// A BotMsg accumulates text across many `token` events and carries metadata
// derived from the `metadata` / `no_match` events — derived state that no
// single event holds. The reducer in store.ts is the bridge.

export type MessageStatus = "streaming" | "settled" | "error";

export interface UserMsg {
  kind: "user";
  id: string;
  text: string;
  createdAt: number;
}

export interface TeachMsg {
  kind: "teach";
  id: string;
  raw: string;
  createdAt: number;
  acked?: { queue_id: number };
}

export interface BotMsg {
  kind: "bot";
  id: string;
  text: string;
  status: MessageStatus;
  meta: null | {
    // tier/confidence/score/locale are null when the server runs with
    // EXPOSE_MATCH_INSIGHTS=false. pairId stays for voting; lowConfidence
    // stays so the "Teach a better reply" CTA still surfaces.
    tier: MatchTier | null;
    confidence: number | null;
    pairId: number | null;
    score: number | null;
    lowConfidence: boolean;
    locale: string | null;
  };
  noMatch: boolean;
  vote: -1 | 0 | 1;
  // The user input this bot reply responded to. Captured at placeholder
  // creation so the inline TeachComposer can teach against the *specific*
  // input the user clicked "Teach a better reply" on, instead of relying
  // on server-side sessions.last_input which moves with every new turn.
  // Undefined for bot messages not preceded by user input (none today —
  // teach branches don't create bot placeholders — kept optional for
  // future shapes).
  userInput?: string;
  createdAt: number;
}

export interface SystemMsg {
  kind: "system";
  id: string;
  text: string;
  variant: "success" | "info" | "error";
  createdAt: number;
}

export type ChatMessage = UserMsg | TeachMsg | BotMsg | SystemMsg;
