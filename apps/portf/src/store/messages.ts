import type { ChatStreamEvent } from "@simlm/types";
import { create } from "zustand";

import { FALLBACK_EN, PERSIST_DEBOUNCE_MS, TITLE_MAX_LEN } from "@/features/chat/tokens";
import type { BotMessage, ChatMessage, UserMessage } from "@/features/chat/types";
import { clearAbort, getOrCreateAbort } from "@/lib/inflight";
import { streamChatPortf } from "@/lib/streamChat";
import { useThreadsStore } from "@/store/threads";

interface MessagesState {
  byThread: Record<string, ChatMessage[]>;
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
    // Quota exceeded / serialize failure — silent. The in-memory state is
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

  async send(threadId, rawText) {
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
      createdAt: Date.now(),
    };

    set((s) => {
      const prior = s.byThread[threadId] ?? [];
      return { byThread: { ...s.byThread, [threadId]: [...prior, userMsg, botMsg] } };
    });

    const ac = getOrCreateAbort(threadId);

    try {
      for await (const ev of streamChatPortf(threadId, trimmed, ac.signal)) {
        applyEvent(get, threadId, botMsg.id, ev);
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
    set((s) => ({
      byThread: {
        ...s.byThread,
        [threadId]: (s.byThread[threadId] ?? []).map((m) =>
          m.kind === "bot" && m.id === id ? { ...m, status } : m,
        ),
      },
    }));
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
      set({ byThread: parsed });
    } catch {
      // Parse error — silently reset (in-memory empty state already correct).
    }
  },
}));

function applyEvent(
  get: () => MessagesState,
  threadId: string,
  botId: string,
  ev: ChatStreamEvent,
): void {
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
      });
      break;
    case "no_match":
      get().applyNoMatch(threadId, botId, FALLBACK_EN);
      break;
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
