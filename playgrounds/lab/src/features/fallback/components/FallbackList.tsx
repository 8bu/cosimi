import { Fragment, useState } from "react";
import { Icon } from "@/lib/icon";
import { Btn, Tag } from "@/components/shell/atoms";
import type { MissVM } from "@/lib/adapters/view-models";

export type SourceFilter = "all" | "chat" | "llm" | "retrieve";

const SOURCES: SourceFilter[] = ["all", "chat", "llm", "retrieve"];
const SOURCE_LABEL: Record<SourceFilter, string> = {
  all: "All",
  chat: "chat",
  llm: "llm",
  retrieve: "retrieve",
};

export function FallbackList({
  misses,
  source,
  onSource,
  onTest,
  onIngest,
}: {
  misses: MissVM[];
  source: SourceFilter;
  onSource: (s: SourceFilter) => void;
  onTest: (q: string) => void;
  onIngest: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="tbar">
        <div className="filterbar">
          {SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              className={"fpill" + (source === s ? " on" : "")}
              aria-pressed={source === s}
              onClick={() => onSource(s)}
            >
              {SOURCE_LABEL[s]}
              <span className="c">
                {s === "all" ? misses.length : misses.filter((m) => m.source === s).length}
              </span>
            </button>
          ))}
        </div>
        <span className="tbar-spacer" />
        <span className="kicker">sorted by frequency</span>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Missed query</th>
              <th scope="col" style={{ width: 96, textAlign: "right" }}>
                Volume
              </th>
              <th scope="col" style={{ width: 120 }}>
                Source
              </th>
              <th scope="col" style={{ width: 150 }}>
                Last seen
              </th>
              <th scope="col" style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {misses.map((m) => {
              const isOpen = open === m.id;
              return (
                <Fragment key={m.id}>
                  <tr
                    className={isOpen ? "sel" : ""}
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : m.id)}
                  >
                    <td className="r-strong">{m.query}</td>
                    <td className="r-num">{m.count}</td>
                    <td>
                      <Tag>{m.source}</Tag>
                    </td>
                    <td
                      className="r-num"
                      style={{ textAlign: "left", color: "var(--ink-3)", fontSize: 11.5 }}
                    >
                      {m.lastSeen}
                    </td>
                    <td>
                      <Icon
                        name={isOpen ? "chevD" : "chevR"}
                        size={15}
                        style={{ color: "var(--ink-4)" }}
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="sel">
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div
                          style={{
                            padding: "16px 18px",
                            display: "grid",
                            gridTemplateColumns: "1fr 300px",
                            gap: 24,
                          }}
                        >
                          <div>
                            <div className="sheet-sec-h">Diagnosis</div>
                            <div className="kv">
                              <dt>Query</dt>
                              <dd>{m.query}</dd>
                              <dt>Source</dt>
                              <dd>{m.source}</dd>
                              <dt>Volume</dt>
                              <dd>{m.count}</dd>
                              <dt>Last seen</dt>
                              <dd className="mono">{m.lastSeen}</dd>
                            </div>
                          </div>
                          <div>
                            <div className="sheet-sec-h">Suggested action</div>
                            <div
                              className="answer"
                              style={{ marginBottom: 12, padding: "12px 14px" }}
                            >
                              <div className="answer-k">
                                <Icon name="spark" size={13} />
                                Recommended
                              </div>
                              <div className="answer-t" style={{ fontSize: 13 }}>
                                Curate this gap — author a pair or ingest a doc covering it.
                              </div>
                            </div>
                            <div className="col" style={{ gap: 8 }}>
                              <Btn
                                icon="upload"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onIngest();
                                }}
                              >
                                Ingest a document
                              </Btn>
                              <Btn
                                sm
                                icon="retrieve"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTest(m.query);
                                }}
                              >
                                Test
                              </Btn>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
        <span className="kicker">{misses.length} fallbacks</span>
        <span className="kicker">click a row to curate</span>
      </div>
    </>
  );
}
