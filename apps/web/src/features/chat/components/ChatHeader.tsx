import { useStats } from "@/api/stats";
import { useSession } from "@/store/session";
import { useTranslate } from "@/lib/i18n";
import { LocaleSwitcher } from "@/features/chat/components/LocaleSwitcher";

// Editorial header: serif title, terse one-line context, mono session
// prefix at the trailing edge. No avatar, no "online" pill, no shadow box.
// The locale switcher sits between subtitle and session prefix — quiet
// trailing chrome, native <select>, no popover.
export function ChatHeader() {
  const sessionId = useSession((s) => s.sessionId);
  const { data } = useStats();
  const t = useTranslate();
  const prefix = sessionId?.slice(0, 4) ?? "...";
  const count = data?.total_pairs_learned ?? 0;

  return (
    <header className="border-b pb-4 mb-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Bé Sim</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t("header.subtitle").replace("{count}", count.toLocaleString())}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LocaleSwitcher />
          <span className="text-xs font-mono text-muted-foreground tabular-nums">#{prefix}</span>
        </div>
      </div>
    </header>
  );
}
