/* Ingest — left column: Source card + Chunking & embedding card.
   Ported from neolab-ref/screen-ingest.jsx, reconciled to the real backend
   (spec §4.3): only Upload + Paste are wired; chunking config is display-only
   disabled (the SDK auto-chunks with bge-m3). */
import { useRef, useState } from "react";
import { Btn, Field, Select } from "@/components/shell/atoms";
import { Icon } from "@/lib/icon";
import { getAnthropicKey, setAnthropicKey } from "@/config/anthropic-key";
import type { IngestArgs, IngestOptions } from "@/lib/api/admin-client";

type SrcTab = "url" | "file" | "paste" | "repo";

const TABS: { key: SrcTab; label: string; enabled: boolean }[] = [
  { key: "url", label: "URL / Crawl", enabled: false },
  { key: "file", label: "Upload", enabled: true },
  { key: "paste", label: "Paste text", enabled: true },
  { key: "repo", label: "Repo sync", enabled: false },
];

/** Pairs/chunk picker label → numeric pairsPerChunk (undefined = SDK auto). */
const PAIRS_OPTIONS = ["Off", "Auto", "Exactly 1", "Exactly 3"];
function pairsPerChunkFor(label: string): number | undefined {
  switch (label) {
    case "Off":
      return 0;
    case "Exactly 1":
      return 1;
    case "Exactly 3":
      return 3;
    default:
      return undefined; // Auto
  }
}

export function IngestForm({
  onStart,
  running,
  done,
  onReset,
}: {
  onStart: (args: IngestArgs) => void;
  running: boolean;
  done: boolean;
  onReset: () => void;
}) {
  const [srcTab, setSrcTab] = useState<SrcTab>("file");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pairsLabel, setPairsLabel] = useState("Auto");
  const [reverseCheck, setReverseCheck] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(() => !!getAnthropicKey());
  const fileInput = useRef<HTMLInputElement>(null);

  function buildOptions(): IngestOptions | undefined {
    const pairsPerChunk = pairsPerChunkFor(pairsLabel);
    const opts: IngestOptions = {};
    if (pairsPerChunk !== undefined) opts.pairsPerChunk = pairsPerChunk;
    if (reverseCheck) opts.reverseCheck = true;
    return Object.keys(opts).length ? opts : undefined;
  }

  function saveKeyIfEntered() {
    if (keyInput.trim()) {
      setAnthropicKey(keyInput.trim());
      setHasKey(true);
      setKeyInput("");
    }
  }

  function handleStart() {
    saveKeyIfEntered();
    const options = buildOptions();
    if (srcTab === "file") {
      if (!file) return;
      onStart({ mode: "upload", file, options });
    } else {
      if (!content.trim()) return;
      onStart({ mode: "paste", title: title.trim() || "Untitled", content, options });
    }
  }

  return (
    <div className="col" style={{ gap: 22 }}>
      {/* ── Source card ── */}
      <div className="card">
        <div className="card-head">
          <Icon name="link" size={17} style={{ color: "var(--accent)" }} />
          <div>
            <div className="card-head-t">Source</div>
            <div className="card-head-sub">Where the content comes from</div>
          </div>
        </div>
        <div className="card-body">
          <div className="src-tabs" role="tablist" aria-label="Ingest source">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={srcTab === t.key}
                disabled={!t.enabled}
                title={t.enabled ? undefined : "not supported yet"}
                className={"src-tab" + (srcTab === t.key ? " on" : "")}
                style={t.enabled ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
                onClick={() => t.enabled && setSrcTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {srcTab === "file" && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.md,.txt,.docx,text/markdown,text/plain,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div
                className="drop"
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
                }}
              >
                <Icon
                  name="upload"
                  size={30}
                  className="drop-ico"
                  style={{ margin: "0 auto 10px" }}
                />
                <div className="drop-t">{file ? file.name : "Drop a file or click to browse"}</div>
                <div className="drop-d">PDF, Markdown, TXT, DOCX</div>
              </div>
            </>
          )}

          {srcTab === "paste" && (
            <Field label="Raw text">
              <textarea
                className="textarea"
                placeholder="Paste document text here…"
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </Field>
          )}

          {(srcTab === "paste" || srcTab === "file") && (
            <div style={{ marginTop: 16 }}>
              <Field
                label="Document title"
                hint={srcTab === "file" ? "Defaults to the file name" : undefined}
              >
                <input
                  className="input"
                  placeholder="e.g. SSO & SAML Integration Guide"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
            </div>
          )}

          {!hasKey && (
            <div style={{ marginTop: 16 }}>
              <Field
                label="Anthropic API key"
                hint="Stored locally in this browser; sent only with the ingest request."
              >
                <input
                  className="input input-mono"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-ant-…"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* ── Chunking & embedding card ── */}
      <div className="card">
        <div className="card-head">
          <Icon name="sliders" size={17} style={{ color: "var(--accent)" }} />
          <div>
            <div className="card-head-t">Chunking &amp; embedding</div>
            <div className="card-head-sub">How the source is split and vectorized</div>
          </div>
        </div>
        <div className="card-body">
          <div className="frow-3">
            <Field label="Strategy" hint="Auto-selected by the SDK">
              <Select value="Auto" onChange={() => {}} options={["Auto"]} disabled />
            </Field>
            <Field label="Chunk size" hint="tokens">
              <input className="input input-mono" value="auto" disabled readOnly />
            </Field>
            <Field label="Overlap" hint="graph, not text">
              <input className="input input-mono" value="0" disabled readOnly />
            </Field>
          </div>
          <div className="frow" style={{ marginTop: 14 }}>
            <Field label="Embedding model">
              <Select value="bge-m3" onChange={() => {}} options={["bge-m3"]} disabled />
            </Field>
            <Field label="Pairs / chunk" hint="Q/A synthesis">
              <Select value={pairsLabel} onChange={setPairsLabel} options={PAIRS_OPTIONS} />
            </Field>
          </div>

          <label className="row" style={{ marginTop: 16, gap: 9, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={reverseCheck}
              onChange={(e) => setReverseCheck(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>Verify question matches answer</span>
          </label>

          <hr className="hrule" />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {!running && !done && (
              <Btn kind="pri" icon="bolt" onClick={handleStart}>
                Start ingestion
              </Btn>
            )}
            {running && (
              <Btn icon="clock" disabled>
                Running…
              </Btn>
            )}
            {done && (
              <Btn icon="refresh" onClick={onReset}>
                Run again
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
