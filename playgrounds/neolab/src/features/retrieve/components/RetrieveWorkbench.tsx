/* Retrieve workbench — query bar + param row + ranked hits + grounded answer.
   The backend is vector-only/deterministic: mode is locked to `vector`
   (hybrid/lexical shown disabled to communicate the constraint), and the only
   honest timing metric is the client round-trip (`tookMs`). Everything the
   backend cannot supply (searched/embed ms) renders as an em dash. */
import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/shell/atoms";
import { Icon } from "@/lib/icon";
import type { DocVM } from "@/lib/adapters";
import { useRetrieveStore } from "../store";
import { HitCard } from "./HitCard";

const MODES = ["hybrid", "vector", "lexical"] as const;
const ACTIVE_MODE = "vector";
const TOP_KS = [3, 5, 8] as const;

export function RetrieveWorkbench({
  presetQuery,
  autoRun,
  docs,
}: {
  presetQuery?: string;
  autoRun?: boolean;
  docs: DocVM[];
}) {
  const result = useRetrieveStore((s) => s.result);
  const isLoading = useRetrieveStore((s) => s.isLoading);
  const tuning = useRetrieveStore((s) => s.tuning);
  const activeHit = useRetrieveStore((s) => s.activeHit);
  const submit = useRetrieveStore((s) => s.submit);
  const setTuning = useRetrieveStore((s) => s.setTuning);
  const setActiveHit = useRetrieveStore((s) => s.setActiveHit);

  const [query, setQuery] = useState(presetQuery ?? "");

  // doc lookups for title + doctype glyph
  const docTitle = (id: string) => docs.find((d) => d.id === id)?.title ?? null;
  const docType = (id: string) => docs.find((d) => d.id === id)?.type;

  function run() {
    void submit(query, docTitle);
  }

  // auto-run once when arriving with a preset query (e.g. from Fallback "Test")
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRun && presetQuery && !autoRanRef.current) {
      autoRanRef.current = true;
      void submit(presetQuery, docTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, presetQuery]);

  return (
    <div className="rwork" style={{ position: "relative" }}>
      {/* ── query bar ── */}
      <div className="rquery">
        <div className="rquery-box">
          <div className="rquery-input">
            <Icon name="retrieve" size={18} style={{ color: "var(--ink-4)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask the knowledge base a question…"
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
            {query && (
              <span
                className="iconbtn"
                style={{ width: 26, height: 26, border: 0 }}
                onClick={() => setQuery("")}
              >
                <Icon name="close" size={14} />
              </span>
            )}
          </div>
          <Btn kind="pri" icon={isLoading ? "clock" : "bolt"} onClick={run} disabled={isLoading}>
            {isLoading ? "Retrieving…" : "Retrieve"}
          </Btn>
        </div>
        <div className="rparams">
          <div className="rparam">
            <span className="rparam-l">Mode</span>
            <div className="seg">
              {MODES.map((m) => {
                const locked = m !== ACTIVE_MODE;
                return (
                  <button
                    key={m}
                    className={m === ACTIVE_MODE ? "on" : ""}
                    disabled={locked}
                    aria-pressed={m === ACTIVE_MODE}
                    title={locked ? "vector-only backend" : undefined}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rparam">
            <span className="rparam-l">Top-K</span>
            <div className="seg">
              {TOP_KS.map((k) => (
                <button
                  key={k}
                  className={tuning.topK === k ? "on" : ""}
                  aria-pressed={tuning.topK === k}
                  onClick={() => setTuning("topK", k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="rparam">
            <span className="rparam-l">Floor</span>
            <span className="tag">{tuning.minSimilarity.toFixed(2)} cosine</span>
          </div>
          <div className="rparam">
            <span className="rparam-l">Filter</span>
            <span className="tag">all collections</span>
          </div>
        </div>
      </div>

      {/* ── results ── */}
      <div className="rresults">
        {!result ? (
          <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
            <Icon
              name="retrieve"
              size={40}
              style={{ margin: "0 auto 14px", color: "var(--ink-4)", opacity: 0.5 }}
            />
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-2)" }}>
              Test a query against the live index
            </div>
            <p className="psub" style={{ margin: "8px auto 0" }}>
              Run a retrieval to inspect ranked chunks, vector scores, and the grounded answer.
              Press <span className="kbd">⏎</span> or hit Retrieve.
            </p>
            {presetQuery && (
              <Btn kind="pri" icon="bolt" onClick={run} style={{ marginTop: 18 }}>
                Retrieve “{presetQuery.slice(0, 32)}…”
              </Btn>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div className="rmeta-line">
              <span>searched —</span>
              <span>·</span>
              <span>{result.tookMs ?? "—"} ms total</span>
              <span>·</span>
              <span>embed —</span>
              <span>·</span>
              <span>
                {ACTIVE_MODE} · top-{tuning.topK}
              </span>
              <span className="right" />
            </div>

            {result.answer && (
              <div className="answer">
                <div className="answer-k">
                  <Icon name="spark" size={13} />
                  Grounded answer
                </div>
                <div className="answer-t">
                  {result.answer.text}
                  <span className="answer-cite">{result.answer.cite}</span>
                </div>
              </div>
            )}

            {result.hits.map((h) => (
              <HitCard
                key={`${h.kind}-${h.rank}-${h.chunkId ?? h.docId}`}
                hit={h}
                floor={tuning.minSimilarity}
                mode={ACTIVE_MODE}
                active={activeHit?.chunkId === h.chunkId && activeHit?.rank === h.rank}
                docType={docType(h.docId)}
                onClick={() => setActiveHit(h)}
              />
            ))}

            <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
              <span className="kicker">all hits above floor</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
