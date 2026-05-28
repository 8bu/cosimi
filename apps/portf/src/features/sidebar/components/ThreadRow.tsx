import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useThreadsStore, type ThreadIndexEntry } from "@/store/threads";
import { formatRelativeTs } from "@/lib/formatRelativeTs";

interface ThreadRowProps {
  entry: ThreadIndexEntry;
}

/**
 * One sidebar row. Class names from portfolio.css (`.v1-thread`,
 * `.v1-dot`, `.v1-thread-meta`).
 *
 * Interactions:
 *   - Click row              → navigate to /chat/<id>
 *   - Double-click label     → inline rename input (Enter commits, Esc cancels)
 *   - Click × button         → window.confirm → threads.remove (which
 *                              cascades into messages + sessions). If
 *                              the removed row was active, the cascade
 *                              navigates away - handled by the parent.
 *
 * The × button stops propagation BEFORE confirm so clicking it never
 * triggers the row's navigation click.
 */
export function ThreadRow({ entry }: ThreadRowProps) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const isActive = entry.id === params.threadId;
  const rename = useThreadsStore((s) => s.rename);
  const remove = useThreadsStore((s) => s.remove);
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.title ?? "");

  return (
    <div
      className={`v1-thread${isActive ? " active" : ""}`}
      onClick={() => {
        if (isEditing) return;
        void navigate({
          to: "/chat/$threadId",
          params: { threadId: entry.id },
          search: { artifact: undefined },
        });
      }}
    >
      <span className="v1-dot" />
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              rename(entry.id, draft.trim() || (entry.title ?? "Untitled"));
              setEditing(false);
            } else if (e.key === "Escape") {
              setDraft(entry.title ?? "");
              setEditing(false);
            }
          }}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(entry.title ?? "");
            setEditing(true);
          }}
        >
          {entry.title ?? "Untitled"}
        </span>
      )}
      <span className="v1-thread-meta">{formatRelativeTs(entry.ts)}</span>
      <button
        type="button"
        aria-label="Remove thread"
        className="thread-remove"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm("Remove this thread?")) {
            remove(entry.id);
          }
        }}
      >
        ×
      </button>
    </div>
  );
}
