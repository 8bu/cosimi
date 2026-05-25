import { useState } from "react";
import { Undo2 } from "lucide-react";
import { useRollback, type RollbackArgs } from "@/api/rollback";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const SOURCE_OPTIONS: { value: "" | RollbackArgs["source"]; label: string }[] = [
  { value: "", label: "— any —" },
  { value: "seed", label: "seed" },
  { value: "user", label: "user" },
  { value: "chat", label: "chat" },
  { value: "llm", label: "llm" },
];

export function RollbackView() {
  const [source, setSource] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [batchId, setBatchId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rollback = useRollback();

  // Native <input type="number" min=1 step=1> blocks the obvious typos
  // client-side (negative, fractional, alpha). Server's valibot schema
  // rejects malformed values too — defense in depth, not a duplicate
  // validator. We still string-parse here because <input type="number">
  // emits "" when empty and a numeric string otherwise.
  const batchIdNum = batchId.trim() ? Number(batchId) : undefined;
  const args: RollbackArgs = {
    source: source ? (source as RollbackArgs["source"]) : undefined,
    topic: topic.trim() || undefined,
    batch_id:
      batchIdNum !== undefined && Number.isFinite(batchIdNum) && batchIdNum > 0
        ? batchIdNum
        : undefined,
  };
  const hasAny =
    args.source !== undefined || args.topic !== undefined || args.batch_id !== undefined;

  const summarize = () => {
    const parts: string[] = [];
    if (args.source) parts.push(`source=${args.source}`);
    if (args.topic) parts.push(`topic=${args.topic}`);
    if (args.batch_id !== undefined) parts.push(`batch_id=${args.batch_id}`);
    return parts.join(", ");
  };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <header>
        <h1 className="text-lg font-medium">Rollback</h1>
        <p className="text-sm text-muted-foreground">
          Soft-delete pairs by filter. Rolled-back rows stay in the database with{" "}
          <code className="font-mono">deleted_at</code> set — restore individually from the Pairs
          view if needed.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Source</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border bg-card p-2 text-sm"
            aria-label="Source"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Topic</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. humor"
            className="rounded-md border bg-card p-2 text-sm"
            aria-label="Topic"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Batch ID</span>
          <input
            type="number"
            min={1}
            step={1}
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="e.g. 42"
            className="rounded-md border bg-card p-2 text-sm"
            aria-label="Batch ID"
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">At least one filter required.</span>
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={!hasAny || rollback.isPending}
          >
            <Undo2 className="mr-2 size-4" /> Rollback…
          </Button>
        </div>

        {rollback.isSuccess && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            Rolled back <span className="font-medium">{rollback.data.affected}</span> rows.
          </div>
        )}
        {rollback.isError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          >
            {rollback.error.message}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Roll back matching pairs?"
        destructive
        confirmLabel="Yes, roll back"
        onConfirm={() => {
          rollback.mutate(args);
          setConfirmOpen(false);
        }}
      >
        This will soft-delete every pair matching <code className="font-mono">{summarize()}</code>.
        Rolled-back rows are recoverable individually from the Pairs view.
      </ConfirmDialog>
    </section>
  );
}
