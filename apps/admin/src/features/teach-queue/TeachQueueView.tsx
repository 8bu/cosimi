import { useEffect, useRef, useState } from "react";
import { useApprove, useTeachQueue, type QueueStatus } from "@/api/teach-queue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/Pagination";
import { QueueRow } from "./QueueRow";
import { BulkActionBar } from "./BulkActionBar";
import { RejectDialog } from "./RejectDialog";

const PAGE_SIZE = 50;

export function TeachQueueView() {
  const [status, setStatus] = useState<QueueStatus>("pending");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Phase 15: keyboard nav state.
  // `activeIdx` is the focused row index (within `items`). It's only
  // meaningful when status === 'pending' (a/r approve/reject the focused
  // row, which only exists in that tab). j/k clamp to [0, items.length-1].
  // `lastClickedIdx` is the anchor for shift-click range selection — the
  // last single-click checkbox, against which the next shift-click
  // computes a range.
  const [activeIdx, setActiveIdx] = useState(0);
  const lastClickedIdxRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectIds, setRejectIds] = useState<number[]>([]);
  const approve = useApprove();
  const { data, isLoading } = useTeachQueue({
    status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const items = data?.items ?? [];

  // Prune `selected` to ids still present in `items`. A per-row Approve
  // or Reject removes its row on refetch, but the parent's Set kept the
  // orphan id — leaving the bulk-action bar showing a stale count and
  // queueing dead ids for the next bulk operation. Keying on the joined
  // id list keeps the effect stable across React's reference-fresh
  // arrays. The early-return preserves the Set identity when nothing
  // changed (avoids re-render churn).
  const itemIdsKey = items.map((i) => i.id).join(",");
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(items.map((i) => i.id));
      const pruned = new Set([...prev].filter((id) => live.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey]);

  // Keep activeIdx in range when items shrink (e.g. after an
  // approve/reject removes the focused row from the page).
  useEffect(() => {
    setActiveIdx((idx) => {
      if (items.length === 0) return 0;
      return Math.min(idx, items.length - 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey]);

  // j/k/a/r — SCOPED to the teach-queue section, not a global window
  // listener. Operators typing 'j' in a search input on another admin
  // page (or in the future, a global header search) shouldn't fire
  // approve/reject. The scope is the outermost <section> ref, and we
  // also suppress when focus is inside an editable element on the page.
  useEffect(() => {
    if (status !== "pending") return;
    const el = sectionRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      // Suppress if user is typing in an input/textarea/etc. anywhere
      // within the section (e.g. the reject-note textarea inside the
      // dialog) — the dialog is portaled outside the section so this
      // also acts as a "no shortcut bindings while a dialog is open"
      // guard via the active element check.
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        active?.isContentEditable === true
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "j":
          e.preventDefault();
          setActiveIdx((i) => Math.min(items.length - 1, i + 1));
          break;
        case "k":
          e.preventDefault();
          setActiveIdx((i) => Math.max(0, i - 1));
          break;
        case "a": {
          const row = items[activeIdx];
          if (!row) return;
          e.preventDefault();
          approve.mutate(row.id);
          break;
        }
        case "r": {
          const row = items[activeIdx];
          if (!row) return;
          e.preventDefault();
          setRejectIds([row.id]);
          setRejectOpen(true);
          break;
        }
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [items, activeIdx, status, approve]);

  // Shift-click range select. The QueueRow's onToggle now passes the
  // index + the originating event; we compute the inclusive range from
  // anchor to current and union-into the selected set.
  const onRowToggle = (id: number, idx: number, e: React.MouseEvent | React.ChangeEvent) => {
    const evt = e as React.MouseEvent;
    if (evt.shiftKey && lastClickedIdxRef.current !== null) {
      const a = Math.min(lastClickedIdxRef.current, idx);
      const b = Math.max(lastClickedIdxRef.current, idx);
      const rangeIds = items.slice(a, b + 1).map((r) => r.id);
      setSelected((s) => {
        const next = new Set(s);
        for (const rid of rangeIds) next.add(rid);
        return next;
      });
      return;
    }
    lastClickedIdxRef.current = idx;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(items.map((i) => i.id)));
  const clear = () => setSelected(new Set());
  const allChecked = items.length > 0 && selected.size === items.length;

  return (
    <section ref={sectionRef} tabIndex={-1} className="flex flex-col gap-4 focus:outline-none">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">Teach queue</h1>
          <p className="text-sm text-muted-foreground">
            Pending submissions from /teach in the chat UI. Approved entries land in the pairs
            corpus. Press <kbd className="rounded border bg-muted px-1 font-mono text-xs">?</kbd>{" "}
            for shortcuts.
          </p>
        </div>
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as QueueStatus);
            setPage(0);
            clear();
            setActiveIdx(0);
            lastClickedIdxRef.current = null;
          }}
        >
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {status === "pending" && selected.size > 0 && (
        <BulkActionBar selected={selected} onCleared={clear} />
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              {status === "pending" && (
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allChecked}
                    onChange={(e) => (e.target.checked ? selectAll() : clear())}
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">Input</th>
              <th className="px-3 py-2 font-medium">Proposed response</th>
              <th className="px-3 py-2 font-medium">Session</th>
              <th className="px-3 py-2 font-medium">Submitted</th>
              <th className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && items.length === 0 && (
              <TableSkeleton rows={5} cols={status === "pending" ? 6 : 5} />
            )}
            {items.map((row, idx) => (
              <QueueRow
                key={row.id}
                row={row}
                status={status}
                selected={selected.has(row.id)}
                onToggle={(e) => onRowToggle(row.id, idx, e)}
                focused={status === "pending" && idx === activeIdx}
              />
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={status === "pending" ? 6 : 5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  <div className="font-medium text-foreground">
                    {status === "pending"
                      ? "Teach queue is empty"
                      : status === "approved"
                        ? "No approved submissions yet"
                        : "No rejected submissions"}
                  </div>
                  <p className="mt-1">
                    {status === "pending"
                      ? "When chat users send /teach <reply>, submissions appear here for review."
                      : "Switch tabs to review pending submissions."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(page > 0 || items.length === PAGE_SIZE) && (
        <Pagination page={page} hasMore={items.length === PAGE_SIZE} onChange={setPage} />
      )}

      {/* Reject dialog is hoisted to the view level so the `r` shortcut
          can open it for the focused row without that row having to
          render its own dialog instance. Per-row reject in QueueRow
          still uses its own RejectDialog — the two paths are
          independent. */}
      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} ids={rejectIds} />
    </section>
  );
}
