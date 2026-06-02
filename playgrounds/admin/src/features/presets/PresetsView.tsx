import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { DEFAULT_PRESET_ID, type ConfigPreset } from "@/config/presets-schema";
import { useAllPresets, usePresetsStore } from "@/config/presets-store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PresetFormDialog } from "@/components/PresetFormDialog";
import { RelativeTime } from "@/components/RelativeTime";

/**
 * /presets — CRUD over `ConfigPreset` localStorage entities. Flat URL
 * (no /settings/* hub) per the sibling-routes precedent; regroup if a
 * second settings-shaped route ever appears.
 *
 * Empty-state is never reached because the synthetic Default is always
 * present — no <EmptyState> usage here.
 */
export function PresetsView() {
  const all = useAllPresets();
  const activeId = usePresetsStore((s) => s.activeId);
  const deletePreset = usePresetsStore((s) => s.delete);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigPreset | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<ConfigPreset | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (p: ConfigPreset) => {
    setEditing(p);
    setFormOpen(true);
  };

  const onConfirmDelete = () => {
    if (!confirmDelete) return;
    const wasActive = confirmDelete.id === activeId;
    deletePreset(confirmDelete.id);
    setConfirmDelete(undefined);
    if (wasActive) {
      // Deleting the active preset implicitly switches off it. Same UX
      // as a normal switch — toast lead-in then reload.
      toast.message("Switched to Default…");
      setTimeout(() => window.location.reload(), 500);
    } else {
      toast.success("Preset deleted");
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Backend presets</h1>
          <p className="text-sm text-muted-foreground">
            Named backend URLs stored locally. The active preset is what every admin request
            targets. Switching reloads the page.
          </p>
        </div>
        <Button onClick={openCreate}>+ New preset</Button>
      </header>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">API base</th>
              <th className="px-3 py-2 font-medium">Active?</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p) => {
              const isDefault = p.id === DEFAULT_PRESET_ID;
              const isActive = p.id === activeId;
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-3">
                    {isDefault ? (
                      <>
                        <span>Default</span>
                        <span className="ml-2 text-xs text-muted-foreground">(build-time)</span>
                      </>
                    ) : (
                      p.name
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{p.apiBase}</td>
                  <td className="px-3 py-3">
                    {isActive ? (
                      <Check className="size-4 text-primary" aria-label="Active" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {isDefault ? "—" : <RelativeTime when={p.createdAt} />}
                  </td>
                  <td className="px-3 py-3 text-right space-x-2">
                    {!isDefault && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(p)}
                          aria-label={`Delete preset ${p.name}`}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PresetFormDialog open={formOpen} onOpenChange={setFormOpen} preset={editing} />
      <ConfirmDialog
        open={confirmDelete !== undefined}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(undefined);
        }}
        title="Delete preset?"
        destructive
        onConfirm={onConfirmDelete}
      >
        This removes the local entry for{" "}
        <code className="font-mono">{confirmDelete?.name ?? ""}</code>. The backend itself is
        unaffected.
      </ConfirmDialog>
    </section>
  );
}
