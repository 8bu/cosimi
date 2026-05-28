import type { ChatStreamEvent } from "@simlm/types";
import { create } from "zustand";

import { matchArtifact } from "@/features/artifacts/match";
import {
  FAKE_STREAM_BASE_MS,
  FAKE_STREAM_JITTER_MS,
  FALLBACK_EN_POOL,
  PERSIST_DEBOUNCE_MS,
  TITLE_MAX_LEN,
} from "@/features/chat/tokens";
import type { BotMessage, ChatMessage, UserMessage } from "@/features/chat/types";
import { clearAbort, getOrCreateAbort } from "@/lib/inflight";
import { streamChatPortf } from "@/lib/streamChat";
import { usePreferencesStore } from "@/store/preferences";
import { useThreadsStore } from "@/store/threads";

interface MessagesState {
  byThread: Record<string, ChatMessage[]>;
  /**
   * Per-thread streaming flag. Mirrors `apps/web`'s single `isStreaming`
   * boolean but partitioned by thread (portf is multi-thread). Sparse:
   * absent key = not streaming, presence (value `true`) = streaming.
   * Composer reads this to disable input + send button + re-focus on
   * the streaming -> idle transition.
   */
  streamingByThread: Record<string, true>;
  send: (threadId: string, rawText: string) => Promise<void>;
  appendBotToken: (threadId: string, id: string, token: string) => void;
  finishBot: (threadId: string, id: string, status: "settled" | "error") => void;
  applyMetadata: (threadId: string, id: string, meta: BotMessage["meta"]) => void;
  applyNoMatch: (threadId: string, id: string, fallbackText: string) => void;
  clear: (threadId: string) => void;
  hydrate: () => void;
}

const STORAGE_KEY = "portf.messages";

// Debounced persist scheduler. Module-level, intentionally outside zustand.
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushPersistNow(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const blob = useMessagesStore.getState().byThread;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Quota exceeded / serialize failure - silent. The in-memory state is
    // authoritative; reload degrades to "transcript lost" gracefully.
  }
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersistNow();
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Per-turn pipeline:
 *   1. trim + empty-guard
 *   2. threadsStore.create(id)              (idempotent)
 *   3. threadsStore.touch(id)               (bump ts)
 *   4. threadsStore.setTitleIfEmpty(id,…)   (first-send only)
 *   5. push UserMessage
 *   6. push BotMessage placeholder { status: 'streaming', text: '' }
 *   7. for await ev of streamChatPortf(...): mutate the placeholder
 *   8. finally: ensure bot is not stranded in 'streaming'; flush persist
 */
export const useMessagesStore = create<MessagesState>((set, get) => ({
  byThread: {},
  streamingByThread: {},

  async send(threadId, rawText) {
    // Re-entrancy guard: if this thread is already streaming a reply,
    // drop the new send. Mirrors apps/web/src/features/chat/store.ts:50.
    if (get().streamingByThread[threadId]) return;

    const trimmed = rawText.trim();
    if (!trimmed) return;

    const threads = useThreadsStore.getState();
    threads.create(threadId);
    threads.touch(threadId);
    threads.setTitleIfEmpty(threadId, trimmed.slice(0, TITLE_MAX_LEN));

    const userMsg: UserMessage = {
      kind: "user",
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: Date.now(),
    };
    const botMsg: BotMessage = {
      kind: "bot",
      id: crypto.randomUUID(),
      text: "",
      status: "streaming",
      meta: null,
      noMatch: false,
      artifactSlug: null,
      createdAt: Date.now(),
    };

    set((s) => ({
      byThread: { ...s.byThread, [threadId]: [...(s.byThread[threadId] ?? []), userMsg, botMsg] },
      streamingByThread: { ...s.streamingByThread, [threadId]: true },
    }));

    const ac = getOrCreateAbort(threadId);

    try {
      for await (const ev of streamChatPortf(threadId, trimmed, ac.signal)) {
        // applyEvent is async so the no_match arm can AWAIT the fake-stream
        // before the outer for-await advances. This keeps streamingByThread
        // true for the entire visible animation (matched + no-match alike).
        await applyEvent(get, threadId, botMsg.id, ev);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        get().finishBot(threadId, botMsg.id, "error");
        void import("sonner").then(({ toast }) =>
          toast.error("Couldn't reach the server.", {
            description: (err as Error).message,
          }),
        );
      }
    } finally {
      const current = get().byThread[threadId]?.find((m) => m.id === botMsg.id);
      if (current?.kind === "bot" && current.status === "streaming") {
        get().finishBot(threadId, botMsg.id, "settled");
      }
      set((s) => {
        const next = { ...s.streamingByThread };
        delete next[threadId];
        return { streamingByThread: next };
      });
      clearAbort(threadId);
      flushPersistNow();
    }
  },

  appendBotToken(threadId, id, token) {
    set((s) => ({
      byThread: {
        ...s.byThread,
        [threadId]: (s.byThread[threadId] ?? []).map((m) =>
          m.kind === "bot" && m.id === id ? { ...m, text: m.text + token } : m,
        ),
      },
    }));
    schedulePersist();
  },

  finishBot(threadId, id, status) {
    set((s) => {
      const thread = s.byThread[threadId] ?? [];
      const botIdx = thread.findIndex((m) => m.id === id && m.kind === "bot");
      if (botIdx < 0) return s;

      let nextArtifactSlug: string | null = null;
      if (status === "settled") {
        // Scan backwards for the user message immediately preceding the bot.
        for (let i = botIdx - 1; i >= 0; i--) {
          const candidate = thread[i];
          if (candidate?.kind === "user") {
            const bot = thread[botIdx];
            if (bot?.kind === "bot") {
              const primaryLocale = usePreferencesStore.getState().primaryLocale;
              const descriptor = matchArtifact({
                input: candidate.text,
                tier: bot.meta?.tier ?? null,
                primaryLocale,
                topic: bot.meta?.topic ?? null,
              });
              nextArtifactSlug = descriptor?.slug ?? null;
            }
            break;
          }
        }
      }

      return {
        byThread: {
          ...s.byThread,
          [threadId]: thread.map((m, i) =>
            i === botIdx && m.kind === "bot" ? { ...m, status, artifactSlug: nextArtifactSlug } : m,
          ),
        },
      };
    });
    flushPersistNow();
  },

  applyMetadata(threadId, id, meta) {
    set((s) => ({
      byThread: {
        ...s.byThread,
        [threadId]: (s.byThread[threadId] ?? []).map((m) =>
          m.kind === "bot" && m.id === id ? { ...m, meta } : m,
        ),
      },
    }));
    schedulePersist();
  },

  applyNoMatch(threadId, id, fallbackText) {
    set((s) => ({
      byThread: {
        ...s.byThread,
        [threadId]: (s.byThread[threadId] ?? []).map((m) =>
          m.kind === "bot" && m.id === id ? { ...m, noMatch: true, text: fallbackText } : m,
        ),
      },
    }));
    schedulePersist();
  },

  clear(threadId) {
    set((s) => {
      const next = { ...s.byThread };
      delete next[threadId];
      return { byThread: next };
    });
    flushPersistNow();
  },

  hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, ChatMessage[]>;

      // Normalize legacy v1 bot messages that lack artifactSlug. The persisted
      // disk shape is wrapper-less; backward compat is handled here so the
      // in-memory shape is uniformly string | null (never undefined).
      for (const thread of Object.values(parsed)) {
        for (const msg of thread) {
          if (msg.kind === "bot" && msg.artifactSlug === undefined) {
            msg.artifactSlug = null;
          }
        }
      }

      set({ byThread: parsed });
    } catch {
      // Parse error - silently reset (in-memory empty state already correct).
    }
  },
}));

async function applyEvent(
  get: () => MessagesState,
  threadId: string,
  botId: string,
  ev: ChatStreamEvent,
): Promise<void> {
  switch (ev.type) {
    case "session":
      // Adoption happens inside streamChatPortf; no UI mutation needed.
      break;
    case "metadata":
      get().applyMetadata(threadId, botId, {
        tier: ev.tier,
        confidence: ev.confidence,
        lowConfidence: ev.lowConfidence,
        locale: ev.locale,
        topic: ev.topic,
      });
      break;
    case "no_match": {
      // Pick a random fallback so back-to-back misses don't repeat
      // verbatim. Mark the bubble as no_match (empty text), then AWAIT
      // the char-by-char fake stream inline. Awaiting keeps the outer
      // for-await in send() paused, which keeps streamingByThread true
      // until the visible animation completes. Mirrors apps/web's
      // `await streamFallback(...)` pattern.
      const idx = Math.floor(Math.random() * FALLBACK_EN_POOL.length);
      const fallback = FALLBACK_EN_POOL[idx]!;
      get().applyNoMatch(threadId, botId, "");
      await fakeStreamFallback(get, threadId, botId, fallback);
      break;
    }
    case "token":
      get().appendBotToken(threadId, botId, ev.content);
      break;
    case "teach_ack":
      // Defensive no-op. Phase E does not surface /teach; if a visitor
      // types literal `/teach …`, the server still processes it and emits
      // this event, but we don't render anything special. The empty bot
      // placeholder will settle on `done`.
      break;
    case "done": {
      // Only settle if the bot isn't already in a terminal state (e.g.
      // an `error` event preceding `done` should not be overwritten).
      const current = get().byThread[threadId]?.find((m) => m.id === botId);
      if (current?.kind === "bot" && current.status !== "error") {
        get().finishBot(threadId, botId, "settled");
      }
      break;
    }
    case "error":
      get().finishBot(threadId, botId, "error");
      void import("sonner").then(({ toast }) => toast.error(ev.message));
      break;
  }
}

/**
 * Client-side fake stream for `no_match` fallback text. Server only
 * emits the `no_match` event (no per-token pacing for misses) so the
 * client paces the fallback char-by-char itself to match the matched-
 * reply streaming UX. Self-running; aborts implicitly if the bot bubble
 * is removed (`appendBotToken` becomes a no-op when the bot id isn't
 * found).
 */
async function fakeStreamFallback(
  get: () => MessagesState,
  threadId: string,
  botId: string,
  text: string,
): Promise<void> {
  for (const ch of text) {
    const delay = FAKE_STREAM_BASE_MS + Math.random() * FAKE_STREAM_JITTER_MS;
    await new Promise((r) => setTimeout(r, delay));
    get().appendBotToken(threadId, botId, ch);
  }
}
