import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BotMessage } from "@/features/chat/components/BotMessage";
import { ChatEmptyState } from "@/features/chat/components/ChatEmptyState";
import { SystemMessage } from "@/features/chat/components/SystemMessage";
import { TeachMessage } from "@/features/chat/components/TeachMessage";
import { UserMessage } from "@/features/chat/components/UserMessage";
import { useChat } from "@/features/chat/store";
import { useTranslate } from "@/lib/i18n";

// How close to the bottom counts as "at-bottom" for the auto-scroll
// + pill-visibility decision. 80px ≈ one short message — small enough
// that the user clearly scrolled up, large enough to absorb scroll
// snap quirks on iOS Safari.
const AT_BOTTOM_THRESHOLD = 80;

export function MessageList() {
  const messages = useChat((s) => s.messages);
  const t = useTranslate();
  const scrollerRef = useRef<HTMLElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Find the nearest scrollable ancestor exactly once — the chat route
  // wraps this in a `flex-1 overflow-y-auto` <div>. Searching upward
  // keeps MessageList re-usable if another route ever wraps it
  // differently. The ref is the listener target and the scroll source
  // for the pill click.
  useEffect(() => {
    let el: HTMLElement | null = endRef.current?.parentElement?.parentElement ?? null;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY)) break;
      el = el.parentElement;
    }
    if (el && el !== document.body) scrollerRef.current = el;
  }, []);

  // Track distance-from-bottom on scroll. The state flip drives both
  // the pill visibility and the auto-scroll guard below.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance < AT_BOTTOM_THRESHOLD);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll only when the user is already near the bottom. Yanking
  // them away from a message they scrolled up to read is the failure
  // mode this guard prevents. Re-fires on every token append while
  // streaming via the tickerLen dep.
  const last = messages.at(-1);
  const tickerLen = last?.kind === "bot" ? last.text.length : 0;
  useEffect(() => {
    if (atBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, tickerLen, atBottom]);

  const jumpToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (messages.length === 0) {
    return <ChatEmptyState />;
  }

  return (
    <>
      {/* aria-live="polite" announces streamed bot tokens to screen
          readers without interrupting in-progress speech. aria-busy
          flips true while the latest message is streaming so AT users
          can choose to wait for the settled text rather than chase
          per-token updates. */}
      <section
        className="flex flex-col gap-3 min-h-[400px]"
        aria-live="polite"
        aria-busy={last?.kind === "bot" && last.status === "streaming"}
        aria-relevant="additions text"
      >
        {messages.map((m) => {
          switch (m.kind) {
            case "user":
              return <UserMessage key={m.id} msg={m} />;
            case "teach":
              return <TeachMessage key={m.id} msg={m} />;
            case "bot":
              return <BotMessage key={m.id} msg={m} />;
            case "system":
              return <SystemMessage key={m.id} msg={m} />;
          }
        })}
        <div ref={endRef} />
      </section>

      {!atBottom && (
        <button
          type="button"
          onClick={jumpToBottom}
          aria-label={t("scroll.toBottom")}
          className="fixed bottom-24 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md transition-opacity hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <ArrowDown className="size-3.5" />
          {t("scroll.toBottom")}
        </button>
      )}
    </>
  );
}
