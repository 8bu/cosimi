import { Link } from "@tanstack/react-router";
import { Icon, type IconName } from "@/lib/icon";
import { useStats } from "@/features/documents/hooks";
import { useIngestStore } from "@/features/ingest/store";

const NAV: {
  to: string;
  label: string;
  icon: IconName;
  meta: "docs" | "chunks" | "processing" | "misses" | null;
}[] = [
  { to: "/documents", label: "Documents", icon: "docs", meta: "docs" },
  { to: "/corpus", label: "Corpus", icon: "corpus", meta: "chunks" },
  { to: "/ingest", label: "Ingest", icon: "ingest", meta: "processing" },
  { to: "/fallback", label: "Fallback", icon: "fallback", meta: "misses" },
  { to: "/retrieve", label: "Retrieve", icon: "retrieve", meta: null },
];

export function Sidebar() {
  const { data: t } = useStats();
  const processing = useIngestStore((s) => s.jobIds.length);

  const metaFor = (key: NonNullable<(typeof NAV)[number]["meta"]>): string | null => {
    if (!t && key !== "processing") return null;
    switch (key) {
      case "docs":
        return String(t!.docs);
      case "chunks":
        return (t!.chunks / 1000).toFixed(1) + "k";
      case "processing":
        return processing > 0 ? String(processing) : null;
      case "misses":
        return t!.misses > 0 ? String(t!.misses) : null;
    }
  };

  return (
    <aside className="side">
      <div className="side-brand">
        <span className="brand-mark">L</span>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">Lab</div>
          <div className="brand-sub">Knowledge Base</div>
        </div>
      </div>
      <nav className="side-nav">
        <div className="side-sec">Manage</div>
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="nav-item"
            activeProps={{ className: "active" }}
            title={n.label}
          >
            <span className="nav-ico">
              <Icon name={n.icon} size={17} />
            </span>
            <span className="nav-label">{n.label}</span>
            {n.meta && metaFor(n.meta) != null && (
              <span className="nav-meta">{metaFor(n.meta)}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        <span className="side-foot-dot" />
        <div className="side-foot-txt">
          <b>index live</b>
          <br />
          bge-m3 · 1024d
        </div>
      </div>
    </aside>
  );
}
