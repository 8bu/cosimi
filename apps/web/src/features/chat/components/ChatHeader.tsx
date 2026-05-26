import { BRAND } from "@simlm/branding";
import { renderTemplate } from "@simlm/template";
import { useStats } from "@/api/stats";
import { useSession } from "@/store/session";
import { useTranslate } from "@/lib/i18n";
import { LocaleSwitcher } from "@/features/chat/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

// Editorial header: serif title, terse one-line context, mono session
// prefix at the trailing edge. No avatar, no "online" pill, no shadow box.
// The locale switcher sits between subtitle and session prefix — quiet
// trailing chrome, native <select>, no popover.
export function ChatHeader() {
  const sessionId = useSession((s) => s.sessionId);
  const { data, isLoading } = useStats();
  const t = useTranslate();
  const prefix = sessionId?.slice(0, 4) ?? "...";
  const count = data?.total_pairs_learned ?? 0;

  return (
    <header className="border-b pb-4 mb-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{BRAND.name}</h1>
          {/* Shimmer during the first fetch — avoids a "0 pairs learned"
              flash before the stats call resolves. After the first
              success TanStack Query keeps `data` populated across
              background refetches, so the shimmer only appears on the
              very first render. */}
          {isLoading && !data ? (
            <p className="mt-1 h-3 w-48 animate-pulse rounded bg-muted/60" aria-hidden />
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {renderTemplate(t("header.subtitle"), { count: count.toLocaleString() })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LocaleSwitcher />
          <ThemeToggle />
          <span className="text-xs font-mono text-muted-foreground tabular-nums">#{prefix}</span>
        </div>
      </div>
    </header>
  );
}
