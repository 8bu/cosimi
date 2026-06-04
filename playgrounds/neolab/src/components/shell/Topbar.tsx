import { useRouterState } from "@tanstack/react-router";
import { Icon } from "@/lib/icon";
import { useShell } from "./shell-store";

const TITLES: Record<string, { t: string; s: string }> = {
  "/documents": { t: "Documents", s: "Every ingested source" },
  "/corpus": { t: "Corpus", s: "Documents · Chunks · Pairs" },
  "/ingest": { t: "Ingest", s: "New source" },
  "/fallback": { t: "Fallback", s: "Retrieval misses" },
  "/retrieve": { t: "Retrieve", s: "Query workbench" },
};

export function Topbar() {
  const toggleRail = useShell((s) => s.toggleRail);
  const rail = useShell((s) => s.rail);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const meta = TITLES[path] ?? { t: "Lab", s: "Knowledge Base" };

  return (
    <header className="topbar">
      <span
        className="rail-toggle"
        onClick={toggleRail}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
        aria-pressed={rail === "collapsed"}
      >
        <Icon name="rail" size={16} />
      </span>
      <div className="crumb">
        <span className="crumb-h">{meta.t}</span>
        <span className="muted" style={{ fontSize: 16 }}>
          /
        </span>
        <span className="crumb-sub">{meta.s}</span>
      </div>
      <span className="topbar-spacer" />
      <span className="badge badge-accent" style={{ height: 28 }}>
        <span className="dot" />
        acme-kb
      </span>
      <span className="iconbtn" title="Account" style={{ borderRadius: "50%" }}>
        <Icon name="user" size={16} />
      </span>
      <label className="gsearch" title="Command palette — coming soon">
        <Icon name="search" size={15} />
        <input placeholder="Search corpus…" disabled />
        <span className="kbd">⌘K</span>
      </label>
    </header>
  );
}
