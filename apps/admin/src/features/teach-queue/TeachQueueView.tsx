import { useState } from "react";
import { useTeachQueue, type QueueStatus } from "@/api/teach-queue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { QueueRow } from "./QueueRow";
import { BulkActionBar } from "./BulkActionBar";

const PAGE_SIZE = 50;

export function TeachQueueView() {
  const [status, setStatus] = useState<QueueStatus>("pending");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { data, isLoading } = useTeachQueue({
    status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const items = data?.items ?? [];

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(items.map((i) => i.id)));
  const clear = () => setSelected(new Set());
  const allChecked = items.length > 0 && selected.size === items.length;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">Teach queue</h1>
          <p className="text-sm text-muted-foreground">
            Pending submissions from /teach in the chat UI. Approved entries land in the pairs
            corpus.
          </p>
        </div>
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as QueueStatus);
            setPage(0);
            clear();
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
            {items.map((row) => (
              <QueueRow
                key={row.id}
                row={row}
                status={status}
                selected={selected.has(row.id)}
                onToggle={() => toggle(row.id)}
              />
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={status === "pending" ? 6 : 5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Nothing in this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(page > 0 || items.length === PAGE_SIZE) && (
        <Pagination page={page} hasMore={items.length === PAGE_SIZE} onChange={setPage} />
      )}
    </section>
  );
}
