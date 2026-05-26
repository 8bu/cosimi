import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { ConfigPreset } from "@/config/presets-schema";
import { usePresetsStore } from "@/config/presets-store";
import { pingBackend } from "@/config/healthcheck";
import { useDebounced } from "@/lib/use-debounced";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: ConfigPreset;
}

type ChipState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; latencyMs: number | null }
  | { kind: "fail" };

/**
 * Create/edit form for a `ConfigPreset`. The reachability chip is
 * advisory and never blocks submit — a backend being down is a normal
 * operational state. Submit-time `store.create`/`store.update` is the
 * authoritative validation gate.
 *
 * The chip's keystroke ping is debounced at 400ms — slow enough that a
 * typist's intermediate values don't fire a probe, fast enough that
 * the operator sees a status before tabbing away.
 */
export function PresetFormDialog({ open, onOpenChange, preset }: Props) {
  const isEdit = preset !== undefined;
  const [name, setName] = useState(preset?.name ?? "");
  const [apiBase, setApiBase] = useState(preset?.apiBase ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [chip, setChip] = useState<ChipState>({ kind: "idle" });
  const create = usePresetsStore((s) => s.create);
  const update = usePresetsStore((s) => s.update);

  // Re-sync state when the dialog opens with a different preset (parent
  // reuses the instance across rows, same shape as EditPairDialog).
  useEffect(() => {
    if (open) {
      setName(preset?.name ?? "");
      setApiBase(preset?.apiBase ?? "");
      setSubmitError(null);
      setChip({ kind: "idle" });
    }
  }, [open, preset?.id, preset?.name, preset?.apiBase]);

  const debouncedApiBase = useDebounced(apiBase, 400);

  useEffect(() => {
    if (!open) return;
    const trimmed = debouncedApiBase.trim();
    if (trimmed.length === 0) {
      setChip({ kind: "idle" });
      return;
    }
    // Validate URL shape before pinging — a malformed value goes
    // straight to "fail" without an outgoing fetch.
    try {
      const parsed = new URL(trimmed, window.location.href);
      if (!parsed.href) throw new Error("invalid");
    } catch {
      setChip({ kind: "fail" });
      return;
    }
    let cancelled = false;
    setChip({ kind: "checking" });
    pingBackend(trimmed).then((r) => {
      if (cancelled) return;
      setChip(r.ok ? { kind: "ok", latencyMs: r.latencyMs } : { kind: "fail" });
    });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedApiBase]);

  const submit = () => {
    setSubmitError(null);
    const result = isEdit ? update(preset!.id, { name, apiBase }) : create({ name, apiBase });
    if (!result.ok) {
      setSubmitError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Preset saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit preset" : "New preset"}</DialogTitle>
          <DialogDescription>
            Presets are stored in this browser only. Switching the active preset reloads the page so
            cached query results from the old backend don't render against the new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground" htmlFor="preset-name">
            Name
          </label>
          <Input
            id="preset-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Staging"
          />
          <label className="text-xs text-muted-foreground" htmlFor="preset-api-base">
            API base
          </label>
          <Input
            id="preset-api-base"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder="/api  or  https://staging.internal:3001"
          />
          <ReachabilityChip chip={chip} />
          {submitError && (
            <p role="alert" className="text-xs text-destructive">
              {submitError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !apiBase.trim()}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReachabilityChip({ chip }: { chip: ChipState }) {
  if (chip.kind === "idle") return null;
  if (chip.kind === "checking") {
    return (
      <span className="inline-block w-fit rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Checking…
      </span>
    );
  }
  if (chip.kind === "ok") {
    return (
      <span className="inline-block w-fit rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
        ✓ reachable{chip.latencyMs !== null ? ` (${chip.latencyMs}ms)` : ""}
      </span>
    );
  }
  return (
    <span className="inline-block w-fit rounded-md bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
      ✗ unreachable
    </span>
  );
}
