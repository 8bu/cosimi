/* Documents table — ported from the design prototype (screen-documents.jsx).
   Differences per spec §4.1: typed over DocVM; client search/filter/sort over the
   passed `docs`; bulk bar is Remove-only (Re-ingest/Re-embed don't exist); tokens
   render `—` when null and the source meta line is omitted when null (never prints
   "null"); the dots actions cell is a stub that stops row-click propagation. */
import { useMemo, useState } from "react";
import { Icon } from "@/lib/icon";
import { Btn, Ck, DType, StatusBadge } from "@/components/shell/atoms";
import type { DocStatus, DocVM } from "@/lib/adapters";

const TYPES = ["all", "pdf", "web", "md", "txt", "api"] as const;
const STATUSES = ["all", "indexed", "processing", "queued", "failed"] as const;

type SortKey = "title" | "chunks" | "pairs" | "tokens" | "added";

export function DocumentsTable({
  docs,
  onOpen,
  onIngest,
  onRemove,
}: {
  docs: DocVM[];
  onOpen: (id: string) => void;
  onIngest: () => void;
  onRemove: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<(typeof STATUSES)[number]>("all");
  const [typeF, setTypeF] = useState<(typeof TYPES)[number]>("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: "asc" | "desc" }>({
    k: "added",
    dir: "desc",
  });
  const [sel, setSel] = useState<Set<string>>(() => new Set());

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    let r = docs.filter((d) => {
      if (statusF !== "all" && d.status !== statusF) return false;
      if (typeF !== "all" && d.type !== typeF) return false;
      if (
        q &&
        !(
          d.title.toLowerCase().includes(needle) ||
          (d.source?.toLowerCase().includes(needle) ?? false) ||
          d.tags.join(" ").toLowerCase().includes(needle)
        )
      )
        return false;
      return true;
    });
    const { k, dir } = sort;
    r = r.toSorted((a, b) => {
      const av = a[k];
      const bv = b[k];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return r;
  }, [docs, q, statusF, typeF, sort]);

  function toggleSort(k: SortKey) {
    setSort((s) => (s.k === k ? { k, dir: s.dir === "asc" ? "desc" : "asc" } : { k, dir: "desc" }));
  }
  function caret(k: SortKey) {
    return sort.k === k ? (
      <span className="sort-caret">{sort.dir === "asc" ? "↑" : "↓"}</span>
    ) : null;
  }
  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  function toggleAll() {
    setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)));
  }

  /* counts come from the full `docs` list, not the filtered rows */
  const statusCount = (s: DocStatus) => docs.filter((d) => d.status === s).length;

  return (
    <>
      <div className="tbar">
        <label className="tbar-search">
          <Icon name="search" size={15} />
          <input
            placeholder="Search title, source, or tag…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <span className="tbar-spacer" />
        <div className="filterbar">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusF === s}
              className={"fpill" + (statusF === s ? " on" : "")}
              onClick={() => setStatusF(s)}
            >
              {s === "all" ? "All status" : s}
              {s !== "all" && <span className="c">{statusCount(s as DocStatus)}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="tbar" style={{ marginTop: -4 }}>
        <div className="filterbar">
          {TYPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={typeF === s}
              className={"fpill" + (typeF === s ? " on" : "")}
              onClick={() => setTypeF(s)}
            >
              {s === "all" ? "All types" : s}
            </button>
          ))}
        </div>
      </div>

      {sel.size > 0 && (
        <div className="bulkbar">
          <Ck on={true} onClick={() => setSel(new Set())} />
          <span>
            <span className="n">{sel.size}</span> selected
          </span>
          <span className="sp" />
          <Btn sm icon="trash" kind="danger" onClick={() => onRemove([...sel])}>
            Remove
          </Btn>
        </div>
      )}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <Ck on={allOn} onClick={toggleAll} />
              </th>
              <th scope="col" className="sortable" onClick={() => toggleSort("title")}>
                Document {caret("title")}
              </th>
              <th scope="col" style={{ width: 116 }}>
                Status
              </th>
              <th
                scope="col"
                className="sortable"
                style={{ width: 90, textAlign: "right" }}
                onClick={() => toggleSort("chunks")}
              >
                Chunks {caret("chunks")}
              </th>
              <th
                scope="col"
                className="sortable"
                style={{ width: 80, textAlign: "right" }}
                onClick={() => toggleSort("pairs")}
              >
                Pairs {caret("pairs")}
              </th>
              <th
                scope="col"
                className="sortable"
                style={{ width: 96, textAlign: "right" }}
                onClick={() => toggleSort("tokens")}
              >
                Tokens {caret("tokens")}
              </th>
              <th
                scope="col"
                className="sortable"
                style={{ width: 110 }}
                onClick={() => toggleSort("added")}
              >
                Added {caret("added")}
              </th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={sel.has(d.id) ? "sel" : ""} onClick={() => onOpen(d.id)}>
                <td>
                  <Ck on={sel.has(d.id)} onClick={() => toggle(d.id)} />
                </td>
                <td>
                  <div className="cell-title">
                    <DType type={d.type} />
                    <div className="cell-title-main">
                      <div className="cell-title-name">{d.title}</div>
                      {(d.source || (d.status === "failed" && d.error)) && (
                        <div className="cell-title-meta">
                          {d.source}
                          {d.status === "failed" && d.error ? (
                            <span style={{ color: "var(--err)" }}>
                              {d.source ? " · " : ""}
                              {d.error}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td className="r-num">{d.chunks || "—"}</td>
                <td className="r-num">{d.pairs || "—"}</td>
                <td className="r-num">{d.tokens ? (d.tokens / 1000).toFixed(1) + "k" : "—"}</td>
                <td className="r-num" style={{ textAlign: "left", color: "var(--ink-3)" }}>
                  {d.added.slice(5)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <span className="iconbtn" style={{ width: 28, height: 28 }} title="Actions">
                    <Icon name="dots" size={15} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 0",
            color: "var(--ink-4)",
            fontSize: 13,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          No documents match these filters.
          <Btn sm icon="upload" onClick={onIngest}>
            Ingest source
          </Btn>
        </div>
      )}
      <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
        <span className="kicker">
          {rows.length} of {docs.length} documents
        </span>
        <span className="kicker">Showing all · no pagination needed</span>
      </div>
    </>
  );
}
