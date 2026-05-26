/**
 * Reachability probe for a candidate backend. Used by the create/edit
 * form's inline chip — never wired into the active-switch flow (a slow
 * backend during a deploy must not block the operator from switching
 * to it). 2s budget; longer than that already feels broken.
 */

export interface PingResult {
  ok: boolean;
  latencyMs: number | null;
}

export async function pingBackend(apiBase: string): Promise<PingResult> {
  const trimmed = apiBase.trim();
  if (trimmed.length === 0) return { ok: false, latencyMs: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  const started = performance.now();
  try {
    const res = await fetch(`${trimmed}/healthz`, {
      method: "GET",
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    return { ok: res.ok, latencyMs };
  } catch {
    return { ok: false, latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}
