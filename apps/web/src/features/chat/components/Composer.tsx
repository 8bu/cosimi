import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/features/chat/store";
import { TEACH_PREFIX_RE } from "@/features/chat/tokens";
import { useTranslate } from "@/lib/i18n";

const LINE_PX = 24;
const MAX_LINES = 6;

export function Composer() {
  const [value, setValue] = useState("");
  const send = useChat((s) => s.send);
  const isStreaming = useChat((s) => s.isStreaming);
  const isTeach = TEACH_PREFIX_RE.test(value);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslate();

  // Auto-grow up to MAX_LINES; the inner element is `resize-none` so the
  // textarea never shows a manual drag handle. Setting height to 'auto'
  // first lets scrollHeight collapse back when the user deletes lines.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_LINES * LINE_PX)}px`;
  }, [value]);

  // Auto-focus on initial mount AND every time a stream completes. The
  // textarea is `disabled` while streaming (browser blurs disabled
  // elements), so a re-focus on the streaming → idle transition is what
  // keeps the user typing without reaching for the mouse between turns.
  useEffect(() => {
    if (!isStreaming) taRef.current?.focus();
  }, [isStreaming]);

  const submit = () => {
    if (!value.trim() || isStreaming) return;
    void send(value);
    setValue("");
  };

  return (
    <footer className="border-t pt-4 mt-2">
      <div
        className={`flex gap-2 items-end rounded-lg border bg-card px-3 py-2 transition-colors ${
          isTeach
            ? "border-teach/60 ring-1 ring-teach/20"
            : "focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20"
        }`}
      >
        <textarea
          ref={taRef}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none py-1 leading-6 max-h-36"
          placeholder={t("composer.placeholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={isStreaming}
        />
        <Button
          size="icon"
          variant={value.trim() ? "default" : "ghost"}
          onClick={submit}
          disabled={!value.trim() || isStreaming}
          aria-label={t("composer.send")}
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 px-1">{t("composer.hint")}</p>
    </footer>
  );
}
