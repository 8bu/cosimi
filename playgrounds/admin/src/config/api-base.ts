/**
 * Runtime-resolved `apiBase` for every admin-api call. Replaces the
 * build-time constant exported from `lib/env.ts`. Read fresh on every
 * call — no caching layer beyond what the browser already does for
 * localStorage. Sub-µs cost; avoids stale-tab-with-changed-preset bugs
 * entirely.
 *
 * The synthetic Default preset is materialized here from
 * `import.meta.env.VITE_API_BASE` at module load. It is the only place
 * in the SPA that reads that env var for outgoing requests — every
 * other call site must go through `getApiBase()`.
 */

import { DEFAULT_PRESET_ID } from "@/config/presets-schema";
import { loadActiveId, loadPresets, saveActiveId, STORAGE_KEYS } from "@/config/presets-storage";

const DEFAULT_API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api";

export function getDefaultApiBase(): string {
  return DEFAULT_API_BASE;
}

export function getApiBase(): string {
  const activeId = loadActiveId();
  if (activeId === DEFAULT_PRESET_ID || !activeId) return DEFAULT_API_BASE;
  const presets = loadPresets();
  const found = presets.find((p) => p.id === activeId);
  return found?.apiBase ?? DEFAULT_API_BASE;
}

// Module-level guard so the StrictMode double-invoke of main.tsx's
// effect does not attach the storage listener twice. The flag survives
// HMR by design — we want one listener per page, not per render.
let attached = false;

/**
 * Boot-time hook: side-effect only. Called from `main.tsx` directly
 * after `bootstrapTheme()`, before render.
 *
 *   1. Self-heals a stale `activePresetId` (e.g. preset deleted in
 *      another tab) back to the sentinel — keeps `getApiBase()`'s
 *      stale-fallback symmetric and avoids a wrong-backend request on
 *      the first paint after a foreign delete.
 *   2. Attaches a cross-tab `storage` listener: when another tab
 *      changes `cosimi.config.activePresetId`, this tab reloads. No
 *      toast — Toaster mounts later in the render path, and the reload
 *      is the operator's expected reaction to a foreign-tab switch.
 *
 * Async-incompatible: do not refactor to top-level await; the call
 * order in main.tsx (theme → api-base → render) is the contract.
 */
export function bootstrapApiBase(): void {
  const activeId = loadActiveId();
  if (activeId !== DEFAULT_PRESET_ID) {
    const presets = loadPresets();
    if (!presets.some((p) => p.id === activeId)) {
      saveActiveId(DEFAULT_PRESET_ID);
    }
  }

  if (attached) return;
  attached = true;
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== STORAGE_KEYS.activeId) return;
    window.location.reload();
  });
}
