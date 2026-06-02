import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

/**
 * Admin 404. Plainer than apps/web's chat-aesthetic 404 — admin chrome
 * is dashboard-y, not editorial, so a simple card with a back link
 * matches the surrounding pages.
 */
export default function NotFound() {
  return (
    <section className="flex max-w-md flex-col gap-3 rounded-xl border bg-card p-6">
      <h1 className="text-lg font-medium">No such admin page</h1>
      <p className="text-sm text-muted-foreground">
        The path you opened isn&apos;t one of the admin views. Use the sidebar to navigate.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
      >
        <ArrowLeft className="size-4" />
        Back to Unanswered
      </Link>
    </section>
  );
}
