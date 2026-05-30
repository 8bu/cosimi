import { useThreadsStore, type ThreadIndexEntry } from "@/store/threads";
import { ThreadRow } from "@/features/sidebar/components/ThreadRow";

/**
 * Sidebar thread list. Shape ported from the design source's `V1Sidebar`
 * (`docs/superpowers/artifacts/cosimi2/project/variations-1-2.jsx`):
 * threads grouped under `<div class="v1-section-label">Today</div>` /
 * `Earlier` headings, then `<ThreadRow>` per entry within each section.
 *
 * Today bucket = threads with `ts` within the last 24h; Earlier =
 * everything older. Within each bucket, newest-first by ts. When the
 * Earlier bucket has no rows, render the design's "no other threads yet"
 * empty-state line in place of the list.
 */
const ONE_DAY_MS = 86_400_000;

interface BucketedThreads {
  today: ThreadIndexEntry[];
  earlier: ThreadIndexEntry[];
}

function bucketThreads(threads: readonly ThreadIndexEntry[], now: number): BucketedThreads {
  const sorted = threads.toSorted((a, b) => b.ts - a.ts);
  const today: ThreadIndexEntry[] = [];
  const earlier: ThreadIndexEntry[] = [];
  for (const t of sorted) {
    if (now - t.ts < ONE_DAY_MS) today.push(t);
    else earlier.push(t);
  }
  return { today, earlier };
}

export function ThreadList() {
  const threads = useThreadsStore((s) => s.threads);
  const { today, earlier } = bucketThreads(threads, Date.now());

  return (
    <nav>
      <div className="v1-section-label">Today</div>
      {today.map((t) => (
        <ThreadRow key={t.id} entry={t} />
      ))}

      <div className="v1-section-label">Earlier</div>
      {earlier.length === 0 ? (
        <div
          className="v1-thread"
          style={{ background: "transparent", color: "var(--ink-4)", cursor: "default" }}
        >
          no other threads yet
        </div>
      ) : (
        earlier.map((t) => <ThreadRow key={t.id} entry={t} />)
      )}
    </nav>
  );
}
