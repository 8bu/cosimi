/* Corpus — 3-pane browser: Documents | Chunks | Q/A Pairs (spec §4.2).
   Ported from neolab-ref/screen-corpus.jsx. Chunks/pairs come from the real
   backend via useChunks/useChunkPairs; design-only fields degrade honestly
   (tokens null → "—", pair-count footer omitted, Edit/Re-gen actions hidden). */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Btn, DType, EmptyPane, StatusBadge, Tag } from "@/components/shell/atoms";
import { Icon } from "@/lib/icon";
import type { ChunkVM, DocVM } from "@/lib/adapters";
import { useChunkPairs, useChunks } from "@/features/corpus/hooks";
import { AddPairDialog } from "./AddPairDialog";

function chunkShortId(id: string): string {
  return id.split("#")[1] ?? id;
}

function truncate(text: string, max = 220): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function CorpusBrowser({
  docs,
  initialDoc,
  initialChunk,
}: {
  docs: DocVM[];
  initialDoc?: string;
  initialChunk?: string;
}) {
  const indexedDocs = useMemo(() => docs.filter((d) => d.chunks > 0), [docs]);

  const initialDocId =
    initialDoc && indexedDocs.some((d) => d.id === initialDoc)
      ? initialDoc
      : (indexedDocs[0]?.id ?? null);

  const [docId, setDocId] = useState<string | null>(initialDocId);
  const [chunkId, setChunkId] = useState<string | null>(initialChunk ?? null);
  const [docQ, setDocQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Selecting a different document resets the chunk selection (pane 3 → empty).
  useEffect(() => {
    setChunkId(null);
  }, [docId]);

  const queryClient = useQueryClient();
  const { data: chunks = [] } = useChunks(docId);
  const { data: pairs = [] } = useChunkPairs(chunkId);

  const doc = indexedDocs.find((d) => d.id === docId) ?? null;
  const chunk: ChunkVM | null = chunks.find((c) => c.id === chunkId) ?? null;

  const filteredDocs = docQ
    ? indexedDocs.filter((d) => d.title.toLowerCase().includes(docQ.toLowerCase()))
    : indexedDocs;

  return (
    <div className="corpus">
      {/* ── Pane 1 · Documents ── */}
      <div className="cpane">
        <div className="cpane-head">
          <span className="cpane-title">Documents</span>
          <span className="cpane-count">{filteredDocs.length}</span>
        </div>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
          <label className="tbar-search" style={{ width: "100%", maxWidth: "none", height: 32 }}>
            <Icon name="search" size={14} />
            <input
              placeholder="Filter documents…"
              value={docQ}
              onChange={(e) => setDocQ(e.target.value)}
            />
          </label>
        </div>
        <div className="cpane-body">
          {filteredDocs.map((d) => (
            <div
              key={d.id}
              className={"crow" + (d.id === docId ? " sel" : "")}
              onClick={() => setDocId(d.id)}
            >
              <DType type={d.type} />
              <div className="crow-main">
                <div className="crow-title">{d.title}</div>
                <div className="crow-meta">
                  <span>{d.chunks} chunks</span>
                  <span>·</span>
                  <span>{d.pairs} pairs</span>
                </div>
              </div>
              <Icon name="chevR" size={15} className="crow-arrow" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Pane 2 · Chunks ── */}
      <div className="cpane">
        <div className="cpane-head">
          <span className="cpane-title">Chunks</span>
          {doc && (
            <span className="muted" style={{ fontSize: 11, fontFamily: "var(--fr-mono)" }}>
              {doc.title}
            </span>
          )}
          <span className="cpane-count">{chunks.length}</span>
        </div>
        <div className="cpane-body">
          {chunks.map((c) => (
            <div
              key={c.id}
              className={"chunk" + (c.id === chunkId ? " sel" : "")}
              onClick={() => setChunkId(c.id)}
            >
              <div className="chunk-head">
                <span className="chunk-id">{chunkShortId(c.id)}</span>
                {c.heading && <Tag>{c.heading}</Tag>}
                <span className="right tag">{c.tokens ?? "—"} tok</span>
              </div>
              <div className="chunk-body">{truncate(c.text)}</div>
              <div className="chunk-foot">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: c.embedded ? "var(--ok)" : "var(--ink-4)",
                  }}
                />
                <span>{c.embedded ? "embedded" : "pending"}</span>
              </div>
            </div>
          ))}
          {chunks.length === 0 && (
            <EmptyPane
              icon="layers"
              title="No chunks"
              desc="This document has not been chunked yet."
            />
          )}
        </div>
      </div>

      {/* ── Pane 3 · Q/A Pairs ── */}
      <div className="cpane">
        <div className="cpane-head">
          <span className="cpane-title">Q / A Pairs</span>
          <span className="cpane-count">{chunk ? pairs.length : "—"}</span>
        </div>
        {!chunk ? (
          <EmptyPane
            icon="corpus"
            title="Select a chunk"
            desc="Pick a chunk in the middle pane to see the question/answer pairs synthesized from it."
          />
        ) : (
          <div className="cpane-body">
            <div style={{ padding: "14px 14px 6px" }}>
              <div className="sheet-sec-h">Source chunk · {chunkShortId(chunk.id)}</div>
              <div className="fulltext" style={{ fontSize: 12.5 }}>
                {chunk.text}
              </div>
            </div>
            <hr className="hrule" style={{ margin: "10px 14px" }} />
            {pairs.length === 0 && (
              <div style={{ padding: "0 14px", color: "var(--ink-4)", fontSize: 12.5 }}>
                No pairs generated from this chunk.
              </div>
            )}
            {pairs.map((p, i) => (
              <div className="pair" key={p.id ?? i}>
                <div className="pair-q">{p.q}</div>
                <div className="pair-a">{p.a}</div>
                {p.auditStatus && (
                  <div className="pair-foot">
                    <StatusBadge status={p.auditStatus} />
                  </div>
                )}
              </div>
            ))}
            <div style={{ padding: "4px 14px 24px" }}>
              <Btn sm icon="plus" style={{ width: "100%" }} onClick={() => setAddOpen(true)}>
                Add pair manually
              </Btn>
            </div>
          </div>
        )}
      </div>

      <AddPairDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["chunkPairs", chunkId] });
          queryClient.invalidateQueries({ queryKey: ["fallback"] });
        }}
      />
    </div>
  );
}
