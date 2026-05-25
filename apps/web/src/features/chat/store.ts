import { create } from "zustand";
import { streamChat } from "@/api/chat";
import type { BotMsg, ChatMessage, MessageStatus } from "@/features/chat/types";
import { TEACH_PREFIX_RE } from "@/features/chat/tokens";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  send: (rawText: string) => Promise<void>;
  // setVote accepts 0 too — VoteButtons.onError reverts the optimistic
  // update by writing back 0 ("unvoted").
  setVote: (botMsgId: string, vote: -1 | 0 | 1) => void;
  // Exposed for tests; not intended for component use. (Plain names —
  // oxlint flags underscore-prefixed properties.)
  appendBotToken: (id: string, token: string) => void;
  finishBot: (id: string, status: Extract<MessageStatus, "settled" | "error">) => void;
}

const newId = (): string => crypto.randomUUID();

/**
 * Zustand store. UI message types ≠ API event types — this reducer is the
 * bridge. A bot message moves through a small state machine:
 *
 *   created (status=streaming, meta=null, noMatch=false)
 *     → maybe metadata (sets meta)
 *     → maybe no_match (sets noMatch)
 *     → many tokens (accumulates text)
 *     → settled  (status='settled') OR error (status='error')
 *
 * Each SSE event is one transition; the explicit switch keeps the mapping
 * legible. The teach branch uses a *separate* user message (TeachMsg) and
 * does NOT create a bot placeholder — the server doesn't stream a reply
 * for /teach commands, only a teach_ack + done.
 *
 * The map(...) lookup-by-id is O(n) per event. Fine for chat-length
 * histories; do not pre-optimize with a Map index — the discriminated-
 * union narrowing inside `m.kind === 'bot' && m.id === botId ? ... : m`
 * is what makes the reducer readable.
 */
export const useChat = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,

  async send(rawText) {
    if (get().isStreaming) return;
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const isTeach = TEACH_PREFIX_RE.test(trimmed);
    const userMsgId = newId();
    const userMsg: ChatMessage = isTeach
      ? { kind: "teach", id: userMsgId, raw: trimmed, createdAt: Date.now() }
      : { kind: "user", id: userMsgId, text: trimmed, createdAt: Date.now() };
    set((s) => ({ messages: [...s.messages, userMsg], isStreaming: true }));

    // Only the non-teach branch gets a bot placeholder; the server streams
    // a reply via `metadata`/`no_match`/`token`/`done`. The teach branch
    // emits `teach_ack` + `done` only.
    let botId: string | null = null;
    if (!isTeach) {
      const placeholder: BotMsg = {
        kind: "bot",
        id: newId(),
        text: "",
        status: "streaming",
        meta: null,
        noMatch: false,
        vote: 0,
        createdAt: Date.now(),
      };
      botId = placeholder.id;
      set((s) => ({ messages: [...s.messages, placeholder] }));
    }

    try {
      for await (const ev of streamChat({ message: trimmed })) {
        switch (ev.type) {
          case "session":
            // Session adoption is already handled in api/client.ts (the
            // X-Session-Id response header is read on every response,
            // including the very first one). Re-applying it here would
            // double-write to the session store. No-op by design.
            break;
          case "metadata":
            if (botId) {
              const id = botId;
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.kind === "bot" && m.id === id
                    ? {
                        ...m,
                        meta: {
                          tier: ev.tier,
                          confidence: ev.confidence,
                          pairId: ev.pairId,
                          score: ev.score,
                          lowConfidence: ev.lowConfidence,
                        },
                      }
                    : m,
                ),
              }));
            }
            break;
          case "no_match":
            if (botId) {
              const id = botId;
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.kind === "bot" && m.id === id ? { ...m, noMatch: true } : m,
                ),
              }));
            }
            break;
          case "token":
            if (botId) get().appendBotToken(botId, ev.content);
            break;
          case "teach_ack": {
            const queueId = ev.queue_id;
            set((s) => ({
              messages: [
                ...s.messages.map((m) =>
                  m.kind === "teach" && m.id === userMsgId
                    ? { ...m, acked: { queue_id: queueId } }
                    : m,
                ),
                {
                  kind: "system",
                  id: newId(),
                  variant: "success",
                  text: "learned! i'll remember that next time.",
                  createdAt: Date.now(),
                },
              ],
            }));
            break;
          }
          case "done":
            if (botId) get().finishBot(botId, "settled");
            break;
          case "error":
            if (botId) get().finishBot(botId, "error");
            set((s) => ({
              messages: [
                ...s.messages,
                {
                  kind: "system",
                  id: newId(),
                  variant: "error",
                  text: ev.message,
                  createdAt: Date.now(),
                },
              ],
            }));
            break;
        }
      }
    } catch {
      if (botId) get().finishBot(botId, "error");
    } finally {
      // The server's lib/sse.ts writes only the literal `[DONE]` terminator
      // and never a structured `{type:'done'}` event — parseSseStream
      // returns silently on `[DONE]`, so the `case 'done'` arm above never
      // fires under the current wire format. If the bot is still
      // `streaming` here, treat the natural exit of the for-await as the
      // settle signal. Already-settled / already-error bots are untouched
      // (idempotent re-assignment is fine but unnecessary work).
      if (botId) {
        const cur = get().messages.find((m) => m.id === botId);
        if (cur?.kind === "bot" && cur.status === "streaming") {
          get().finishBot(botId, "settled");
        }
      }
      set({ isStreaming: false });
    }
  },

  setVote(botMsgId, vote) {
    set((s) => ({
      messages: s.messages.map((m) => (m.kind === "bot" && m.id === botMsgId ? { ...m, vote } : m)),
    }));
  },

  appendBotToken(id, token) {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.kind === "bot" && m.id === id ? { ...m, text: m.text + token } : m,
      ),
    }));
  },
  finishBot(id, status) {
    set((s) => ({
      messages: s.messages.map((m) => (m.kind === "bot" && m.id === id ? { ...m, status } : m)),
    }));
  },
}));
