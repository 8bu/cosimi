import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, FileText, Upload } from "lucide-react";
import { useImport } from "@/api/import";
import { Button } from "@/components/ui/button";

export function ImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"seed" | "llm">("llm");
  const [topic, setTopic] = useState("");
  const imp = useImport();

  const submit = () => {
    if (!file) return;
    imp.mutate({ file, source, topic: topic.trim() || undefined });
  };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <header>
        <h1 className="text-lg font-medium">Bulk import</h1>
        <p className="text-sm text-muted-foreground">
          Upload a <code className="font-mono">.json</code> array or{" "}
          <code className="font-mono">.jsonl</code> stream of input/response pairs.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">File</span>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 hover:bg-muted/50">
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm">
              {file ? (
                <span className="inline-flex items-center gap-2">
                  <FileText className="size-4" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                <>
                  Choose <code className="font-mono">.json</code> or{" "}
                  <code className="font-mono">.jsonl</code>
                </>
              )}
            </span>
            <input
              type="file"
              accept=".json,.jsonl,.ndjson"
              className="sr-only"
              aria-label="File"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Source</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "seed" | "llm")}
            className="rounded-md border bg-card p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            aria-label="Source"
          >
            <option value="llm">llm — LLM-generated batch</option>
            <option value="seed">seed — hand-curated or external corpus snapshot</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Topic (optional)</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. humor, greetings, smalltalk"
            className="rounded-md border bg-card p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            aria-label="Topic"
          />
          <span className="text-xs text-muted-foreground">
            Recommended — sets a tag so you can roll back exactly this batch&apos;s rows by topic
            later.
          </span>
        </label>

        {/* Inline format reference rather than a link to LLM_IMPORT_FORMAT.md.
            The doc lives at docs/LLM_IMPORT_FORMAT.md in the repo and isn't
            served alongside the admin SPA, so a hard-coded GitHub URL would
            rot the moment the repo moves. Inline keeps the help self-
            contained even offline. */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Format reference</summary>
          <div className="mt-2 flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
            <p>
              Each row is an object with <code className="font-mono">input</code> and{" "}
              <code className="font-mono">response</code> strings (and an optional{" "}
              <code className="font-mono">topic</code>):
            </p>
            <pre className="overflow-x-auto rounded bg-background p-2 text-[11px]">
              {`{"input": "Hello", "response": "Hi there!", "topic": "greetings"}`}
            </pre>
            <p>
              <code className="font-mono">.json</code> files are a single array of these objects.{" "}
              <code className="font-mono">.jsonl</code> / <code className="font-mono">.ndjson</code>{" "}
              files have one object per line — streamed row-by-row so 10k-row imports stay OOM-safe.
            </p>
          </div>
        </details>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!file || imp.isPending}>
            {imp.isPending ? "Importing…" : "Import"}
          </Button>
        </div>

        {imp.isSuccess && imp.data && (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="size-4 text-success" />
            Imported <span className="font-medium">{imp.data.count}</span> pairs under batch{" "}
            <span className="font-mono">#{imp.data.batch_id}</span>.
            <Link
              to={`/pairs?batch_id=${imp.data.batch_id}`}
              className="ml-auto text-primary underline"
            >
              View rows
            </Link>
          </div>
        )}
        {/* Phase 15: error display moved to sonner toast (see useImport
            onError). The success card stays inline — it carries a
            durable "View rows" link the operator may want to click
            after the toast auto-dismisses. */}
      </div>
    </section>
  );
}
