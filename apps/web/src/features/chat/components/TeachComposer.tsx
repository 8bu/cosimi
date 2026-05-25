import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/features/chat/store";
import { useTranslate } from "@/lib/i18n";

/**
 * Reusable inline composer. The parent owns the open state and passes
 * `onSubmit` to close itself.
 *
 * `forInput` opt: when set, the teach is bound to that specific input
 * via the explicit form `/teach "input" => "reply"`. Without it, falls
 * back to the implicit form `/teach <reply>` which the server resolves
 * against `sessions.last_input`. The inline CTA on a bot message always
 * passes `forInput` (snapshot of the input that produced this turn) —
 * that's the fix for the "I clicked teach on turn 1 but it taught turn
 * 2 because I'd sent another message in between" race.
 *
 * The server's EXPLICIT_RE (`/^"([^"]+)"\s*=>\s*"([^"]+)"$/` in
 * apps/api/src/services/teach-parser.ts) has no escape syntax — strings
 * containing `"` would break parsing. We fall back to the implicit form
 * in that case rather than producing a broken `/teach` command.
 */
export function TeachComposer({ onSubmit, forInput }: { onSubmit: () => void; forInput?: string }) {
  const [reply, setReply] = useState("");
  const send = useChat((s) => s.send);
  const t = useTranslate();

  const submit = () => {
    const trimmedReply = reply.trim();
    if (!trimmedReply) return;
    const canExplicit = forInput && !forInput.includes('"') && !trimmedReply.includes('"');
    const command = canExplicit
      ? `/teach "${forInput}" => "${trimmedReply}"`
      : `/teach ${trimmedReply}`;
    void send(command);
    setReply("");
    onSubmit();
  };

  const prompt = forInput ? t("teach.promptFor").replace("{input}", forInput) : t("teach.prompt");

  return (
    <div className="rounded-md border border-teach/30 bg-teach/[0.04] p-3 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{prompt}</p>
      <textarea
        rows={2}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        autoFocus
        className="w-full bg-card border rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-teach/40 font-serif"
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onSubmit}>
          {t("teach.cancel")}
        </Button>
        <Button size="sm" onClick={submit} disabled={!reply.trim()}>
          {t("teach.submit")}
        </Button>
      </div>
    </div>
  );
}
