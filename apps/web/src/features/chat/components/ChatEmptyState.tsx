import { withBrand } from "@simlm/branding";
import { MessageCircle } from "lucide-react";
import { useTranslate } from "@/lib/i18n";

/**
 * First-paint welcome card. Rendered only when `messages.length === 0`.
 * The intent is conversational — a hint that the surface accepts free
 * text and a `/teach` mention so first-timers learn the command without
 * a separate onboarding modal.
 */
export function ChatEmptyState() {
  const t = useTranslate();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="rounded-full border bg-card p-4 text-primary">
        <MessageCircle className="size-7" />
      </div>
      <h2 className="font-serif text-xl font-medium">{withBrand(t("empty.greeting"))}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{t("empty.hint")}</p>
    </div>
  );
}
