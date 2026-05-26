/**
 * Persisted shape of a `ConfigPreset` and the wrapper that lives under
 * `simlm.config.presets`. Pure types + a runtime validator — no React,
 * no DOM, no zustand. The store/storage layers compose on top.
 *
 * The synthetic Default preset is NEVER persisted under this shape; it
 * is materialized at runtime from `import.meta.env.VITE_API_BASE`. See
 * `config/api-base.ts` and `config/presets-store.ts`.
 */

export interface ConfigPreset {
  id: string;
  name: string;
  apiBase: string;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedPresets {
  version: 1;
  presets: ConfigPreset[];
}

export const PRESETS_VERSION = 1 as const;

/** Sentinel `activeId` for "use the synthetic Default preset". */
export const DEFAULT_PRESET_ID = "__default__" as const;

/**
 * Validate parsed JSON against the persisted shape. Returns the
 * structurally-checked value or null. Cheap — used on every storage
 * read, but reads happen at most once per page render path (the store's
 * boot + the cross-tab listener), not per request.
 */
export function parsePersistedPresets(raw: unknown): PersistedPresets | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== PRESETS_VERSION) return null;
  if (!Array.isArray(obj.presets)) return null;
  const presets: ConfigPreset[] = [];
  for (const entry of obj.presets) {
    if (typeof entry !== "object" || entry === null) return null;
    const p = entry as Record<string, unknown>;
    if (
      typeof p.id !== "string" ||
      typeof p.name !== "string" ||
      typeof p.apiBase !== "string" ||
      typeof p.createdAt !== "number" ||
      typeof p.updatedAt !== "number"
    ) {
      return null;
    }
    presets.push({
      id: p.id,
      name: p.name,
      apiBase: p.apiBase,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }
  return { version: PRESETS_VERSION, presets };
}
