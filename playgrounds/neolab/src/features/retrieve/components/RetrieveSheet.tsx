/* Detail slide-over for the active retrieval hit, built on the prebuilt Sheet.
   Honest gaps: lexical scoring + token/tag/origin metadata don't exist on the
   vector-only backend, so those rows are omitted or rendered `—`. The chunk text
   is already escaped + highlighted by the adapter. */
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Btn, Meter } from "@/components/shell/atoms";
import { Sheet } from "@/components/ui/sheet";
import { highlight } from "@/lib/adapters";
import type { DocVM, HitVM } from "@/lib/adapters";
import { useRetrieveStore } from "../store";

export function RetrieveSheet({ docs }: { docs: DocVM[] }) {
  const navigate = useNavigate();
  const activeHit = useRetrieveStore((s) => s.activeHit);
  const result = useRetrieveStore((s) => s.result);
  const setActiveHit = useRetrieveStore((s) => s.setActiveHit);

  const hit = activeHit;
  const doc = hit ? docs.find((d) => d.id === hit.docId) : undefined;
  const query = result?.query ?? "";

  function openInCorpus(h: HitVM) {
    void navigate({
      to: "/corpus",
      search: { doc: h.docId, chunk: h.chunkId ?? undefined },
    });
  }

  async function copy(h: HitVM) {
    try {
      await navigator.clipboard.writeText(h.chunkId ?? h.text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  }

  const footer = hit ? (
    <>
      <Btn icon="corpus" style={{ flex: 1 }} onClick={() => openInCorpus(hit)}>
        Open in Corpus
      </Btn>
      <Btn icon="copy" kind="ghost" onClick={() => void copy(hit)} aria-label="Copy" />
    </>
  ) : undefined;

  return (
    <Sheet
      open={!!hit}
      onClose={() => setActiveHit(null)}
      title={hit ? (hit.docTitle ?? hit.docId) : ""}
      kicker={hit ? `Rank ${hit.rank} · ${hit.score.toFixed(3)}` : undefined}
      dtype={doc?.type}
      footer={footer}
    >
      {hit && (
        <>
          <div className="sheet-sec">
            <div className="sheet-sec-h">Scoring</div>
            <div className="kv">
              <dt>Hybrid</dt>
              <dd>
                <div className="row" style={{ gap: 10 }}>
                  <Meter value={hit.score} />
                  <span className="num">{hit.score.toFixed(3)}</span>
                </div>
              </dd>
              <dt>Vector</dt>
              <dd>
                <div className="row" style={{ gap: 10 }}>
                  <span className="meter" style={{ maxWidth: 120 }}>
                    <span style={{ width: (hit.vec ?? 0) * 100 + "%" }} />
                  </span>
                  <span className="num">{(hit.vec ?? 0).toFixed(3)}</span>
                </div>
              </dd>
            </div>
          </div>

          <div className="sheet-sec">
            <div className="sheet-sec-h">Chunk text</div>
            <div className="fulltext" dangerouslySetInnerHTML={{ __html: hit.text }} />
          </div>

          <div className="sheet-sec">
            <div className="sheet-sec-h">Source</div>
            <div className="kv">
              <dt>Document</dt>
              <dd>{hit.docTitle ?? hit.docId}</dd>
              <dt>Origin</dt>
              <dd>—</dd>
              {hit.page && (
                <>
                  <dt>Page</dt>
                  <dd>{hit.page}</dd>
                </>
              )}
              <dt>Tokens</dt>
              <dd>—</dd>
              <dt>Tags</dt>
              <dd>—</dd>
            </div>
          </div>

          {hit.neighbors.length > 0 && (
            <div className="sheet-sec">
              <div className="sheet-sec-h">Neighboring chunks</div>
              {hit.neighbors.map((n) => (
                <div
                  key={n.id}
                  className="neighbor"
                  onClick={() =>
                    setActiveHit({
                      ...hit,
                      chunkId: n.id,
                      text: highlight(n.text, query),
                      page: n.page,
                      neighbors: [],
                      pairs: [],
                    })
                  }
                >
                  <span className="mono">{n.id.split("#")[1] ?? n.id}</span> ·{" "}
                  {n.text.length > 120 ? n.text.slice(0, 120) + "…" : n.text}
                </div>
              ))}
            </div>
          )}

          {hit.pairs.length > 0 && (
            <div className="sheet-sec">
              <div className="sheet-sec-h">Q/A pairs from this chunk</div>
              {hit.pairs.map((p, i) => (
                <div className="pair" key={i} style={{ marginLeft: 0, marginRight: 0 }}>
                  <div className="pair-q" style={{ fontSize: 12.5 }}>
                    {p.q}
                  </div>
                  <div className="pair-a">{p.a}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
