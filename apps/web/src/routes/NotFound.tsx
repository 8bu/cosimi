import { Link } from "react-router";

export default function NotFound() {
  return (
    <main className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-lg font-medium">Not found</h1>
      <p className="text-sm text-muted-foreground">The page you tried to open doesn't exist.</p>
      <Link to="/" className="text-sm text-primary underline underline-offset-4">
        Back to chat
      </Link>
    </main>
  );
}
