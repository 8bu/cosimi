import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function NotFoundComponent() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Lost?</h1>
      <p>That page doesn't exist.</p>
      <Link to="/">Back to home</Link>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
