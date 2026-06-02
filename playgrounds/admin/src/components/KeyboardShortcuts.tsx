import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  description: string;
  scope?: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"], description: "Show this cheatsheet" },
  { keys: ["j"], description: "Move down a row", scope: "Teach Queue" },
  { keys: ["k"], description: "Move up a row", scope: "Teach Queue" },
  { keys: ["a"], description: "Approve focused row", scope: "Teach Queue" },
  { keys: ["r"], description: "Reject focused row", scope: "Teach Queue" },
  { keys: ["Shift+Click"], description: "Select range between checkboxes", scope: "Teach Queue" },
];

/**
 * `?` toggles a small help dialog. Listens at the window level (this is
 * the meta-shortcut; per-view shortcuts use scoped listeners on their
 * outer section). Suppressed when focus is inside an editable element
 * — operators typing a literal "?" into a search/textarea should not
 * trigger the help.
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable === true
      ) {
        return;
      }
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <kbd className="rounded border bg-muted px-1 font-mono text-xs">?</kbd> any time
            to open this list.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys.join("+") + s.description} className="flex items-center gap-3">
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="flex-1">{s.description}</span>
              {s.scope && <span className="text-xs text-muted-foreground">{s.scope}</span>}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
