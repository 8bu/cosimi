import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePair } from "@/api/pairs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: string;
}

export function TeachDialog({ open, onOpenChange, input }: Props) {
  const [response, setResponse] = useState("");
  const [topic, setTopic] = useState("");
  const create = useCreatePair();

  const reset = () => {
    setResponse("");
    setTopic("");
    create.reset();
  };

  const submit = () => {
    create.mutate(
      { input, response: response.trim(), topic: topic.trim() || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reset on close so reopening with a different input starts clean.
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Teach a reply</DialogTitle>
          <DialogDescription>
            Insert directly into the pairs corpus. This bypasses the teach-queue moderation flow.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground" htmlFor="teach-input">
            Input
          </label>
          <div id="teach-input" className="rounded-md border bg-muted px-3 py-2 text-sm font-mono">
            {input}
          </div>
          <label className="text-xs text-muted-foreground" htmlFor="teach-response">
            Response
          </label>
          <Textarea
            id="teach-response"
            rows={3}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <label className="text-xs text-muted-foreground" htmlFor="teach-topic">
            Topic (optional)
          </label>
          <Input id="teach-topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          {create.isError && (
            <p className="text-xs text-destructive" role="alert">
              {create.error instanceof Error ? create.error.message : "Failed to save pair."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!response.trim() || create.isPending}>
            {create.isPending ? "Saving…" : "Teach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
