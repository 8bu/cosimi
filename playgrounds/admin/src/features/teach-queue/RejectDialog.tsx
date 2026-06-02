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
import { Textarea } from "@/components/ui/textarea";
import { useBatch, useReject } from "@/api/teach-queue";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: number[];
  onRejected?: () => void;
}

/**
 * Single dialog handles both the per-row reject (ids.length === 1) and
 * the bulk reject path. Routing on `ids.length` keeps the bulk action
 * bar from needing its own dialog component. The note is the same
 * shape on both wire endpoints (`reviewer_note?: string`).
 */
export function RejectDialog({ open, onOpenChange, ids, onRejected }: Props) {
  const [note, setNote] = useState("");
  const single = useReject();
  const batch = useBatch();
  const pending = single.isPending || batch.isPending;

  const close = () => {
    onOpenChange(false);
    setNote("");
    single.reset();
    batch.reset();
  };

  const submit = () => {
    const onSuccess = () => {
      close();
      onRejected?.();
    };
    const reviewer_note = note.trim() || undefined;
    if (ids.length === 1) {
      single.mutate({ id: ids[0]!, reviewer_note }, { onSuccess });
    } else {
      batch.mutate({ ids, action: "reject", reviewer_note }, { onSuccess });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reject {ids.length} {ids.length === 1 ? "submission" : "submissions"}
          </DialogTitle>
          {/* Phase 12 learned: Radix Dialog emits an a11y warning if no
              DialogDescription is rendered. One line, then the form. */}
          <DialogDescription>
            Mark {ids.length === 1 ? "this submission" : `these ${ids.length} submissions`} as
            rejected. The optional note is stored alongside the row for the reviewer&apos;s context.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="reject-note" className="text-xs text-muted-foreground">
            Reviewer note (optional)
          </label>
          <Textarea
            id="reject-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
