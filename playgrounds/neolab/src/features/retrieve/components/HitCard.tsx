/* One ranked retrieval hit (`.rhit`). The text is already escaped + `<mark>`-
   highlighted by the retrieve adapter, so it is safe to inject. lex is always
   null on the vector-only backend → rendered as an em dash. */
import { DType, Tag } from "@/components/shell/atoms";
import type { HitVM } from "@/lib/adapters";

export function HitCard({
  hit,
  floor,
  mode,
  active,
  docType,
  onClick,
}: {
  hit: HitVM;
  floor: number;
  mode: string;
  active: boolean;
  docType?: string;
  onClick: () => void;
}) {
  const belowFloor = hit.score < floor;
  return (
    <div className={"rhit" + (active ? " sel" : "")} onClick={onClick}>
      <div className={"rhit-rank" + (hit.rank === 1 ? " top" : "")}>{hit.rank}</div>
      <div className="rhit-body">
        <div className="rhit-src">
          {docType && <DType type={docType} />}
          <span className="rhit-src-name">{hit.docTitle ?? hit.docId}</span>
          {hit.chunkId && <Tag>{hit.chunkId.split("#")[1] ?? hit.chunkId}</Tag>}
          {hit.page && <Tag>p.{hit.page}</Tag>}
        </div>
        <div className="rhit-text" dangerouslySetInnerHTML={{ __html: hit.text }} />
        <div className="row" style={{ marginTop: 9, gap: 14 }}>
          <span className="kicker">
            vec{" "}
            <span className="num" style={{ color: "var(--ink-2)" }}>
              {(hit.vec ?? 0).toFixed(2)}
            </span>
          </span>
          <span className="kicker">
            lex <span className="num">—</span>
          </span>
        </div>
      </div>
      <div className="rhit-score">
        <div className="rhit-score-v" style={{ color: belowFloor ? "var(--err)" : "var(--ink)" }}>
          {hit.score.toFixed(3)}
        </div>
        <div className="rhit-score-l">{mode}</div>
      </div>
    </div>
  );
}
