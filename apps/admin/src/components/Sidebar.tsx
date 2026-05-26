import { NavLink } from "react-router";
import { Inbox, ListChecks, MessagesSquare, Undo2, Upload } from "lucide-react";
import { BRAND } from "@simlm/branding";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

interface Item {
  to: string;
  label: string;
  icon: typeof Inbox;
}

const items: Item[] = [
  { to: "/", label: "Unanswered", icon: Inbox },
  { to: "/pairs", label: "Pairs", icon: MessagesSquare },
  { to: "/teach-queue", label: "Teach Queue", icon: ListChecks },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/rollback", label: "Rollback", icon: Undo2 },
];

export function Sidebar() {
  return (
    <nav className="w-56 border-r bg-card px-3 py-4 flex flex-col gap-1">
      <div className="px-3 pb-3 text-sm font-medium">{BRAND.name} · admin</div>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
      {/* Spacer pushes the toggle to the bottom of the sidebar without
          a fixed wrapper — keeps the layout natural at small heights
          (the toggle scrolls with the nav if the viewport is too short
          for everything to fit). */}
      <div className="mt-auto flex items-center justify-between px-2 pt-4">
        <span className="text-xs text-muted-foreground">Press ? for shortcuts</span>
        <ThemeToggle />
      </div>
    </nav>
  );
}
