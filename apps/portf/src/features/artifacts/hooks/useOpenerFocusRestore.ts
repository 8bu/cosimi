import { useCallback, useEffect, useRef } from "react";

/**
 * Captures the currently-focused element at hook-mount time, returns a
 * restore() callback that re-focuses it. Used by the artifact pane to
 * return focus to the preview card / topic-trigger / wherever the open
 * gesture originated when the pane closes (Esc / × / ← BACK).
 *
 * Falls back to a no-op if focus was on `document.body` at mount (i.e.
 * no meaningful opener).
 */
export function useOpenerFocusRestore(): () => void {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) {
      openerRef.current = el;
    }
  }, []);

  return useCallback(() => {
    openerRef.current?.focus({ preventScroll: true });
  }, []);
}
