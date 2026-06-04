import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRetrieval } from "../store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function QueryComposer() {
  const [value, setValue] = useState("");
  const submit = useRetrieval((s) => s.submit);
  const isLoading = useRetrieval((s) => s.isLoading);
  const send = () => {
    if (!value.trim() || isLoading) return;
    void submit(value);
    setValue("");
  };
  return (
    <div className="flex items-end gap-2 rounded-xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
      <Textarea
        rows={1}
        value={value}
        placeholder="Ask the corpus…"
        aria-label="Query"
        className="min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        disabled={isLoading}
      />
      <Button
        size="icon"
        onClick={send}
        disabled={!value.trim() || isLoading}
        aria-label="Retrieve"
        className="shrink-0"
      >
        <MagnifyingGlass className="size-4" />
      </Button>
    </div>
  );
}
