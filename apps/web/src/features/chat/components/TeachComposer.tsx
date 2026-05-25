import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/features/chat/store";

// Reusable inline composer. The parent (e.g. <BotMessage/>) owns the open
// state and passes `onSubmit` to close itself; this component never reaches
// into parent state. Same shape will be reusable when Phase 12+ adds an
// admin-side teach affordance.
export function TeachComposer({ onSubmit }: { onSubmit: () => void }) {
  const [reply, setReply] = useState("");
  const send = useChat((s) => s.send);

  const submit = () => {
    const trimmed = reply.trim();
    if (!trimmed) return;
    void send(`/teach ${trimmed}`);
    setReply("");
    onSubmit();
  };

  return (
    <div className="rounded-md border border-teach/30 bg-teach/[0.04] p-3 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">What should I have said?</p>
      <textarea
        rows={2}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        autoFocus
        className="w-full bg-card border rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-teach/40 font-serif"
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onSubmit}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!reply.trim()}>
          Teach
        </Button>
      </div>
    </div>
  );
}
