import type { MatchTier } from "@simlm/types";

/**
 * UI message shapes - bridge between API event types and the messages
 * store's discriminated union. ChatStreamEvent (`@simlm/types`) is the
 * WIRE shape; ChatMessage is the SETTLED-STATE shape rendered by
 * `<MessageBubble>`.
 *
 * No `vote` field, no `teach` variant - Phase E is portfolio Q&A only;
 * no thumbs up/down, no /teach surface (per spec §2 non-goals).
 *
 * `meta` fields can be null on the wire when EXPOSE_MATCH_INSIGHTS=false
 * on the server side. We mirror nullability here so the renderer can
 * choose to hide the badge.
 */
export interface UserMessage {
  kind: "user";
  id: string;
  text: string;
  createdAt: number;
}

export interface BotMessage {
  kind: "bot";
  id: string;
  text: string;
  status: "streaming" | "settled" | "error";
  meta: {
    tier: MatchTier | null;
    confidence: number | null;
    lowConfidence: boolean;
    locale: string | null;
    topic: string | null;
  } | null;
  noMatch: boolean;
  /**
   * Slug of an MDX artifact resolved by matchArtifact() at settle time.
   * Null = no card. Phase F (2026-05-28).
   */
  artifactSlug: string | null;
  createdAt: number;
}

export type ChatMessage = UserMessage | BotMessage;
