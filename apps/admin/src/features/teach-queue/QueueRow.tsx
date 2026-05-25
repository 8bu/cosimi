import { useState } from "react";
import type { AdminTeachQueueItem } from "@simlm/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/RelativeTime";
import { useApprove, type QueueStatus } from "@/api/teach-queue";
import { RejectDialog } from "./RejectDialog";

interface Props {
  row: AdminTeachQueueItem;
  status: QueueStatus;
  selected: boolean;
  onToggle: () => void;
}

export function QueueRow({ row, status, selected, onToggle }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const approve = useApprove();

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      {status === "pending" && (
        <td className="px-3 py-3 align-top">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select submission ${row.id}`}
          />
        </td>
      )}
      <td className="px-3 py-3 align-top">
        <div>{row.input}</div>
        {row.flagged && (
          <Badge variant="warning" className="mt-1 text-xs">
            flagged{row.flag_reason ? `: ${row.flag_reason}` : ""}
          </Badge>
        )}
      </td>
      <td className="px-3 py-3 align-top text-muted-foreground">{row.response}</td>
      <td className="px-3 py-3 align-top text-xs font-mono text-muted-foreground">
        {row.submitted_by_session.slice(0, 8)}…
      </td>
      <td className="px-3 py-3 align-top text-muted-foreground">
        <RelativeTime when={row.created_at} />
      </td>
      <td className="px-3 py-3 text-right space-x-2 align-top">
        {status === "pending" && (
          <>
            <Button size="sm" onClick={() => approve.mutate(row.id)} disabled={approve.isPending}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
            <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} ids={[row.id]} />
          </>
        )}
      </td>
    </tr>
  );
}
