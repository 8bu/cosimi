import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useBatch } from "@/api/teach-queue";
import { RejectDialog } from "./RejectDialog";

interface Props {
  selected: Set<number>;
  onCleared: () => void;
}

/**
 * Appears only when ≥1 row is checked (caller's responsibility — keeps
 * the table chrome calm in the default state). "Approve all" goes
 * straight through useBatch; "Reject all…" opens the shared
 * RejectDialog so the operator can attach a note.
 */
export function BulkActionBar({ selected, onCleared }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const batch = useBatch();

  const approveAll = () => {
    batch.mutate({ ids: [...selected], action: "approve" }, { onSuccess: onCleared });
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-2">
      <div className="text-sm">
        <span className="font-medium">{selected.size}</span> selected
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={approveAll} disabled={batch.isPending}>
          Approve all
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
          Reject all…
        </Button>
        <Button size="sm" variant="ghost" onClick={onCleared}>
          Clear
        </Button>
      </div>
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        ids={[...selected]}
        onRejected={onCleared}
      />
    </div>
  );
}
