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
  // Phase 15: signature widened from `() => void` to forward the
  // originating event so the parent can read `e.shiftKey` for
  // range-select. Change/Click events both share the .shiftKey field.
  onToggle: (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => void;
  // Phase 15: when true, paint a subtle focus ring — driven by j/k
  // keyboard nav in the parent. Visual cue only; the actual approve/
  // reject shortcuts are bound at the section scope.
  focused?: boolean;
}

export function QueueRow({ row, status, selected, onToggle, focused }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const approve = useApprove();

  return (
    <tr
      className={`border-b last:border-0 hover:bg-muted/40 ${
        focused ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
      }`}
    >
      {status === "pending" && (
        <td className="px-3 py-3 align-top">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => {
              // Range-select piggybacks on click (which carries shiftKey)
              // because onChange's SyntheticEvent doesn't expose it
              // reliably across browsers. The click handler intercepts
              // shift-clicks; the change handler still fires on plain
              // clicks for the single-toggle path. Both invoke the same
              // parent onToggle — the parent inspects shiftKey to
              // discriminate.
              if (e.shiftKey) {
                e.preventDefault();
                onToggle(e);
              }
            }}
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
