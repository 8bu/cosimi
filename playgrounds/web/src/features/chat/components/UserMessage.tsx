import type { UserMsg } from "@/features/chat/types";
import { useTranslate } from "@/lib/i18n";

export function UserMessage({ msg }: { msg: UserMsg }) {
  const t = useTranslate();
  return (
    <article className="flex flex-col gap-1.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {t("role.you")}
      </div>
      <div className="prose-chat text-foreground whitespace-pre-wrap break-words">{msg.text}</div>
    </article>
  );
}
