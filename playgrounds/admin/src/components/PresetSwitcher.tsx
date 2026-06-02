import { toast } from "sonner";

import { DEFAULT_PRESET_ID } from "@/config/presets-schema";
import { useAllPresets, usePresetsStore } from "@/config/presets-store";

/**
 * Sidebar switcher for the active backend preset. Native <select> per
 * the workspace's earned-it primitive rule — same shape as
 * apps/web's <LocaleSwitcher>.
 *
 * On change: toast → 500ms → window.location.reload(). The reload is
 * load-bearing — TanStack Query keys do not include the apiBase, so
 * cached rows from backend X would silently render against backend Y
 * without it. See CLAUDE.md's runtime-apiBase bullet for the
 * "why not queryClient.clear()" rationale.
 */
export function PresetSwitcher() {
  const all = useAllPresets();
  const activeId = usePresetsStore((s) => s.activeId);
  const setActive = usePresetsStore((s) => s.setActive);

  return (
    <select
      value={activeId}
      onChange={(e) => {
        const nextId = e.target.value;
        const nextEntry = all.find((p) => p.id === nextId);
        if (!nextEntry || nextId === activeId) return;
        setActive(nextId);
        toast.message(`Switching to ${nextEntry.name}…`);
        setTimeout(() => window.location.reload(), 500);
      }}
      aria-label="Active backend"
      className="w-full rounded-md border bg-card px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {all.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id === DEFAULT_PRESET_ID ? "Default (build-time)" : p.name}
        </option>
      ))}
    </select>
  );
}
