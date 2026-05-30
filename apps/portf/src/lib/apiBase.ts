/**
 * Portf API base. Function (not const) - matches the future runtime-config
 * switcher contract used by apps/admin (CLAUDE.md). Phase E does not ship
 * a switcher, but the function shape leaves the door open without
 * snapshotting at module init.
 *
 * VITE_PORTF_API_BASE points at the portf api process (port 3010 in dev).
 * The vite proxy strips `/api/foo` -> `:3010/foo`, so `/api` is the
 * default and pairs with the proxy.
 */
export function apiBase(): string {
  return import.meta.env.VITE_PORTF_API_BASE ?? "/api";
}
