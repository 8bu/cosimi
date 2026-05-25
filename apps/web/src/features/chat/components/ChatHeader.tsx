import { useStats } from "@/api/stats";
import { useSession } from "@/store/session";

// Editorial header: serif title, terse one-line context, mono session
// prefix at the trailing edge. No avatar, no "online" pill, no shadow box.
export function ChatHeader() {
  const sessionId = useSession((s) => s.sessionId);
  const { data } = useStats();
  const prefix = sessionId?.slice(0, 4) ?? "...";
  const count = data?.total_pairs_learned ?? 0;

  return (
    <header className="border-b pb-4 mb-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Bé Sim</h1>
          <p className="text-xs text-muted-foreground mt-1">
            A pattern-matching chatbot · {count.toLocaleString()} pairs learned
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
          #{prefix}
        </span>
      </div>
    </header>
  );
}
