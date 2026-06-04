import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Key } from "@phosphor-icons/react";
import { useIngest, useIngestJob } from "../hooks";
import { JobProgress } from "./JobProgress";
import { getAnthropicKey, setAnthropicKey } from "@/config/anthropic-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "paste" | "upload";

export function IngestForm() {
  const [mode, setMode] = useState<Mode>("paste");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKeyState] = useState(() => getAnthropicKey());
  const [reverseCheck, setReverseCheck] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const ingest = useIngest();
  const job = useIngestJob(jobId);
  const qc = useQueryClient();

  // Fire the toast + refresh the document list exactly once when a job settles.
  const settledRef = useRef<string | null>(null);
  const status = job.data?.status;
  useEffect(() => {
    if (!jobId || !status || status === "running" || settledRef.current === jobId) return;
    settledRef.current = jobId;
    if (status === "done") {
      toast.success(`Ingested — ${job.data!.pairsPassed} pairs`);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } else if (status === "error") {
      toast.error(`Ingest failed — ${job.data!.error ?? "unknown error"}`);
    }
  }, [jobId, status, job.data, qc]);

  const isBusy = ingest.isPending || status === "running";
  const hasKey = apiKey.trim().length > 0;
  const canSubmit =
    !isBusy && hasKey && (mode === "paste" ? !!title.trim() && !!content.trim() : !!file);
  const onKey = (v: string) => {
    setApiKeyState(v);
    setAnthropicKey(v);
  };
  const start = (args: Parameters<typeof ingest.mutate>[0]) => {
    settledRef.current = null;
    ingest.mutate(args, { onSuccess: ({ jobId: id }) => setJobId(id) });
  };
  const submit = () => {
    const options = { reverseCheck };
    if (mode === "paste") {
      if (!title.trim() || !content.trim()) return;
      start({ mode: "paste", title: title.trim(), content, options });
    } else if (file) start({ mode: "upload", file, options });
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ingest a document</CardTitle>
          <CardDescription>
            Runs the offline pipeline: chunk &rarr; build the chunk graph &rarr; LLM-generate
            question/answer pairs &rarr; audit &rarr; embed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="anthropic-key" className="flex items-center gap-1.5">
              <Key className="size-3.5" /> Anthropic API key
            </Label>
            <Input
              id="anthropic-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              aria-label="Anthropic API key"
              placeholder="sk-ant-…"
              onChange={(e) => onKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Stored in this browser only; sent per request, never to the server.
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="paste">Paste</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="doc-title">Title</Label>
                <Input
                  id="doc-title"
                  value={title}
                  aria-label="Title"
                  placeholder="Refund Policy"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="doc-content">Content (markdown)</Label>
                <Textarea
                  id="doc-content"
                  rows={12}
                  value={content}
                  aria-label="Content"
                  placeholder={"## Section\nParagraph text…"}
                  className="font-mono text-sm"
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </TabsContent>
            <TabsContent value="upload" className="flex flex-col gap-2 pt-4">
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                type="file"
                accept=".md,.markdown,.txt"
                aria-label="File"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">Title is taken from the filename.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t pt-6">
          <Label className="flex items-start gap-2 font-normal">
            <input
              type="checkbox"
              checked={reverseCheck}
              aria-label="Verify each question matches its answer"
              onChange={(e) => setReverseCheck(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input accent-primary"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-foreground">Verify each question matches its answer</span>
              <span className="text-xs text-muted-foreground">
                Re-derives a question from every answer and flags mismatches. Slower — an extra
                model call per pair.
              </span>
            </span>
          </Label>
          <Button onClick={submit} disabled={!canSubmit}>
            {isBusy ? "Ingesting…" : "Ingest"}
          </Button>
        </CardFooter>
      </Card>

      {job.data && <JobProgress job={job.data} />}
    </div>
  );
}
