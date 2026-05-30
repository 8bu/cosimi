/**
 * localStorage read/write for `ConfigPreset` state. Synchronous, pure
 * functions — the store calls them write-through on every mutation.
 *
 * Failures (private-mode Safari, exceeded quota, JSON parse errors)
 * are caught at the boundary and swallowed; the caller falls back to
 * in-memory-only state. Mirrors `lib/theme.ts`. The cost of a noisier
 * error path here would be one toast per page load in unusual browsers,
 * which doesn't pay.
 */

import {
  DEFAULT_PRESET_ID,
  parsePersistedPresets,
  PRESETS_VERSION,
  type ConfigPreset,
} from "@/config/presets-schema";

const PRESETS_KEY = "cosimi.config.presets";
const ACTIVE_KEY = "cosimi.config.activePresetId";

/**
 * Read the stored presets list. Returns [] on:
 *   - storage not available
 *   - key absent
 *   - JSON parse error
 *   - shape mismatch (e.g. `version: 99` from a future schema)
 *
 * On version mismatch, console.warn once so an operator inspecting the
 * console sees what happened — but otherwise we silently move on and
 * let them rebuild their list.
 */
export function loadPresets(): ConfigPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    const checked = parsePersistedPresets(parsed);
    if (!checked) {
      // Differentiate "wrong version" from "wrong shape" only insofar as
      // the version mismatch deserves a hint — both reset to empty.
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        (parsed as Record<string, unknown>).version !== PRESETS_VERSION
      ) {
        console.warn(`[cosimi] cosimi.config.presets has unsupported version; resetting to empty.`);
      }
      return [];
    }
    return checked.presets;
  } catch {
    return [];
  }
}

export function savePresets(presets: ConfigPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify({ version: PRESETS_VERSION, presets }));
  } catch {
    // Non-fatal — see module header.
  }
}

export function loadActiveId(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return typeof raw === "string" && raw.length > 0 ? raw : DEFAULT_PRESET_ID;
  } catch {
    return DEFAULT_PRESET_ID;
  }
}

export function saveActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Non-fatal.
  }
}

/** Exposed for tests; production code should not need direct key access. */
export const STORAGE_KEYS = {
  presets: PRESETS_KEY,
  activeId: ACTIVE_KEY,
} as const;
