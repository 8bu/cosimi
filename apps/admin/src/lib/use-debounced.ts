import { useEffect, useState } from "react";

/**
 * Returns a debounced view of `value`. Updates after `delay` ms of no
 * further change. Lives here (not lodash) because the contract is 10
 * lines and the rest of lodash is dead weight; same reasoning as
 * apps/web's per-feature local helpers.
 *
 * Phase 13's PairsFilters search input debounces at 250ms — the lower
 * bound where "typed slowly" still feels reactive while a fast typist's
 * intermediate states don't fire queries.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
