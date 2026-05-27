import { useThreadsStore } from "@/store/threads";
import { ThreadRow } from "@/features/sidebar/components/ThreadRow";

/**
 * Sorts the persisted thread index newest-first by `ts` and renders one
 * `<ThreadRow>` per entry. The sort is computed on each render (cheap —
 * portfolio visitors won't accumulate hundreds of threads); no memo.
 */
export function ThreadList() {
  const threads = useThreadsStore((s) => s.threads);
  const sorted = threads.toSorted((a, b) => b.ts - a.ts);
  return (
    <nav>
      {sorted.map((t) => (
        <ThreadRow key={t.id} entry={t} />
      ))}
    </nav>
  );
}
