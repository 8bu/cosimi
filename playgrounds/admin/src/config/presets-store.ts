/**
 * Zustand store for `ConfigPreset` CRUD. The synthetic Default preset
 * is NOT stored in the array — it's materialized by selectors from
 * `import.meta.env.VITE_API_BASE` so it cannot drift from the bundle's
 * build env.
 *
 * No `persist` middleware: we control localStorage writes via
 * `presets-storage.ts` so quota errors are swallowed at the boundary
 * and tests can reset by clearing storage. Mutations write through
 * synchronously before returning.
 *
 * After every mutation we dispatch a `cosimi:presets-changed` DOM event
 * — `storage` events do NOT fire in the same tab that wrote the value,
 * so any non-React subscribers (none today, but the contract is open)
 * can listen here.
 */

import { create } from "zustand";

import { DEFAULT_PRESET_ID, type ConfigPreset } from "@/config/presets-schema";
import { getDefaultApiBase } from "@/config/api-base";
import { loadActiveId, loadPresets, saveActiveId, savePresets } from "@/config/presets-storage";

interface MutationOk<T = undefined> {
  ok: true;
  id?: T;
}
interface MutationErr {
  ok: false;
  error: string;
}
type CreateResult = { ok: true; id: string } | MutationErr;
type UpdateResult = MutationOk | MutationErr;

interface PresetsStore {
  presets: ConfigPreset[];
  activeId: string;
  create(input: { name: string; apiBase: string }): CreateResult;
  update(id: string, patch: { name?: string; apiBase?: string }): UpdateResult;
  delete(id: string): void;
  setActive(id: string): void;
}

const DEFAULT_NAME_LOWER = "default";
const PRESETS_CHANGED_EVENT = "cosimi:presets-changed";

function validateName(name: string, presets: ConfigPreset[], ignoreId?: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Name cannot be empty.";
  if (trimmed.length > 40) return "Name must be 40 characters or fewer.";
  const lower = trimmed.toLowerCase();
  if (lower === DEFAULT_NAME_LOWER) {
    return `"Default" is reserved for the build-time preset.`;
  }
  const collision = presets.find((p) => p.id !== ignoreId && p.name.trim().toLowerCase() === lower);
  if (collision) return "A preset with this name already exists.";
  return null;
}

function validateApiBase(apiBase: string): string | null {
  const trimmed = apiBase.trim();
  if (trimmed.length === 0) return "API base cannot be empty.";
  try {
    // `new URL(value, location.href)` accepts both '/api' and full
    // origins. We don't keep the parsed URL — only the throw/no-throw
    // signal. Assigned-to-a-var to satisfy oxlint(no-new). The original
    // string is what we store, so an operator pasting "/api" gets
    // "/api" back.
    const parsed = new URL(trimmed, window.location.href);
    if (!parsed.href) return "API base must be a valid URL or path.";
  } catch {
    return "API base must be a valid URL or path.";
  }
  return null;
}

function dispatchChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRESETS_CHANGED_EVENT));
}

export const usePresetsStore = create<PresetsStore>((set, get) => ({
  presets: typeof window === "undefined" ? [] : loadPresets(),
  activeId: typeof window === "undefined" ? DEFAULT_PRESET_ID : loadActiveId(),

  create({ name, apiBase }) {
    const presets = get().presets;
    const nameErr = validateName(name, presets);
    if (nameErr) return { ok: false, error: nameErr };
    const apiErr = validateApiBase(apiBase);
    if (apiErr) return { ok: false, error: apiErr };

    const now = Date.now();
    const id = crypto.randomUUID();
    const entry: ConfigPreset = {
      id,
      name: name.trim(),
      apiBase: apiBase.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const next = [...presets, entry];
    savePresets(next);
    set({ presets: next });
    dispatchChanged();
    return { ok: true, id };
  },

  update(id, patch) {
    const presets = get().presets;
    const idx = presets.findIndex((p) => p.id === id);
    if (idx === -1) return { ok: false, error: "Preset not found." };

    if (patch.name !== undefined) {
      const nameErr = validateName(patch.name, presets, id);
      if (nameErr) return { ok: false, error: nameErr };
    }
    if (patch.apiBase !== undefined) {
      const apiErr = validateApiBase(patch.apiBase);
      if (apiErr) return { ok: false, error: apiErr };
    }

    const existing = presets[idx]!;
    const updated: ConfigPreset = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      apiBase: patch.apiBase !== undefined ? patch.apiBase.trim() : existing.apiBase,
      updatedAt: Date.now(),
    };
    const next = [...presets];
    next[idx] = updated;
    savePresets(next);
    set({ presets: next });
    dispatchChanged();
    return { ok: true };
  },

  delete(id) {
    if (id === DEFAULT_PRESET_ID) return;
    const presets = get().presets;
    if (!presets.some((p) => p.id === id)) return;
    const next = presets.filter((p) => p.id !== id);
    savePresets(next);
    // Deleting the active preset implicitly switches off it. The UI
    // layer triggers the reload after a 500ms toast; the store just
    // resets activeId synchronously so a subsequent getApiBase() reads
    // the right value even before the reload completes.
    const wasActive = get().activeId === id;
    if (wasActive) {
      saveActiveId(DEFAULT_PRESET_ID);
      set({ presets: next, activeId: DEFAULT_PRESET_ID });
    } else {
      set({ presets: next });
    }
    dispatchChanged();
  },

  setActive(id) {
    if (id !== DEFAULT_PRESET_ID && !get().presets.some((p) => p.id === id)) return;
    saveActiveId(id);
    set({ activeId: id });
    dispatchChanged();
  },
}));

/**
 * Selectors. The synthetic Default appears first in `useAllPresets`'s
 * output and is the resolved entry for `useActivePreset` when activeId
 * is the sentinel or stale.
 */
export function syntheticDefaultPreset(): ConfigPreset {
  return {
    id: DEFAULT_PRESET_ID,
    name: "Default",
    apiBase: getDefaultApiBase(),
    createdAt: 0,
    updatedAt: 0,
  };
}

export function useAllPresets(): ConfigPreset[] {
  const presets = usePresetsStore((s) => s.presets);
  return [syntheticDefaultPreset(), ...presets];
}

export function useActivePreset(): ConfigPreset {
  const activeId = usePresetsStore((s) => s.activeId);
  const presets = usePresetsStore((s) => s.presets);
  if (activeId === DEFAULT_PRESET_ID) return syntheticDefaultPreset();
  return presets.find((p) => p.id === activeId) ?? syntheticDefaultPreset();
}

export const PRESETS_CHANGED = PRESETS_CHANGED_EVENT;
