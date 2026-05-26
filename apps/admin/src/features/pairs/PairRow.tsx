import { useState } from "react";
import type { AdminPair } from "@simlm/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useDeletePair, useRestorePair } from "@/api/pairs";
import { EditPairDialog } from "./EditPairDialog";

interface Props {
  pair: AdminPair;
}

export function PairRow({ pair }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useDeletePair();
  const restore = useRestorePair();
  const deleted = pair.deleted_at !== null;

  return (
    <tr className={`border-b last:border-0 ${deleted ? "opacity-50" : "hover:bg-muted/40"}`}>
      <td className="px-3 py-3 max-w-xs">
        <div className="truncate" title={pair.input}>
          {pair.input}
        </div>
        {pair.flagged && (
          <Badge variant="warning" className="mt-1 text-xs">
            flagged
          </Badge>
        )}
      </td>
      <td className="px-3 py-3 max-w-md">
        <div className="truncate text-muted-foreground" title={pair.response}>
          {pair.response}
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge variant="outline">{pair.source}</Badge>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{pair.topic ?? "—"}</td>
      <td className="px-3 py-3 text-right tabular-nums">{pair.score}</td>
      <td className="px-3 py-3 text-right space-x-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        {deleted ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => restore.mutate(pair.id)}
            disabled={restore.isPending}
            aria-label={`Restore pair ${pair.id}`}
          >
            Restore
          </Button>
        ) : (
          // Phase 15: route through ConfirmDialog. Phase 13's one-click
          // delete was reversible (soft-delete + restore in the same
          // view), but operators still appreciate a gate — destructive
          // verbs in admin chrome should consistently require
          // confirmation per the ConfirmDialog convention from Phase 14.
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={del.isPending}
            aria-label={`Delete pair ${pair.id}`}
          >
            Delete
          </Button>
        )}
      </td>
      <EditPairDialog open={editOpen} onOpenChange={setEditOpen} pair={pair} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this pair?"
        destructive
        confirmLabel="Delete"
        onConfirm={() => {
          del.mutate(pair.id);
          setConfirmDelete(false);
        }}
      >
        {/* DialogDescription renders <p>; keep children inline-only.
            Truncate long inputs so the dialog stays compact regardless
            of the source row's length. */}
        Soft-delete <code className="font-mono">{pair.input.slice(0, 60)}</code>
        {pair.input.length > 60 ? "…" : ""}? You can restore from the deleted-filter view.
      </ConfirmDialog>
    </tr>
  );
}
