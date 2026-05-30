import { useCallback, useEffect, useRef } from "react";

const KEY_PREFIX = "portf.artifact-scroll.";

/**
 * Persists the scroll position of the artifact body element per-slug, in
 * sessionStorage. Restores on mount; saves on scroll. Re-opening the same
 * slug in the same tab returns the visitor to where they left off.
 *
 * Returned ref callback attaches the scroll listener; pass to the element
 * whose scrollTop should be tracked (typically `.artifact-panel-body`).
 */
export function useArtifactScrollRestore(slug: string) {
  const elRef = useRef<HTMLElement | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => {
    elRef.current = el;
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const stored = sessionStorage.getItem(KEY_PREFIX + slug);
    const initial = stored ? Number.parseInt(stored, 10) : 0;
    if (Number.isFinite(initial) && initial > 0) {
      el.scrollTop = initial;
    }
    function onScroll() {
      sessionStorage.setItem(KEY_PREFIX + slug, String(el!.scrollTop));
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [slug]);

  return setRef;
}
