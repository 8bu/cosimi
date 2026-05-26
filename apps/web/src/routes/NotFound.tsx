import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { useTranslate } from "@/lib/i18n";

/**
 * Catch-all 404. Matches the chat aesthetic (centered, serif title,
 * small body, terracotta link) rather than the boilerplate card from
 * Phase 9 — the chat is the front door, so the 404 should feel like
 * "wrong door in the same house" instead of a different building.
 */
export default function NotFound() {
  const t = useTranslate();
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-serif text-3xl font-medium">{t("notFound.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("notFound.body")}</p>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
      >
        <ArrowLeft className="size-4" />
        {t("notFound.back")}
      </Link>
    </main>
  );
}
