import { useEffect, useRef } from "react";
import { BotMessage } from "@/features/chat/components/BotMessage";
import { SystemMessage } from "@/features/chat/components/SystemMessage";
import { TeachMessage } from "@/features/chat/components/TeachMessage";
import { UserMessage } from "@/features/chat/components/UserMessage";
import { useChat } from "@/features/chat/store";

export function MessageList() {
  const messages = useChat((s) => s.messages);
  const endRef = useRef<HTMLDivElement>(null);

  // Re-scroll on every token append, not just every new message. Pull the
  // last message once, narrow it, and read text.length — that becomes the
  // second dep, so the effect fires per-token while a bot reply streams.
  const last = messages.at(-1);
  const tickerLen = last?.kind === "bot" ? last.text.length : 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, tickerLen]);

  return (
    <section className="flex flex-col gap-3 min-h-[400px]">
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
  );
}
