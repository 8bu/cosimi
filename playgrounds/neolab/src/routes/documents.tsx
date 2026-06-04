/* Documents screen. Lists real documents (/admin/documents) + corpus stats; a row
   opens the doc in Corpus; the bulk bar removes via DELETE /documents/:id (looped
   through RemoveDialog). Re-sync is hidden (no endpoint); "In pipeline" shows 0 for
   now (active-job wiring is a later task). Deltas are omitted — honest blanks. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHead } from "@/components/shell/PageHead";
import { Stat } from "@/components/shell/Stat";
import { Btn, EmptyPane } from "@/components/shell/atoms";
import { useDocuments, useStats } from "@/features/documents/hooks";
import { useIngestStore } from "@/features/ingest/store";
import { DocumentsTable } from "@/features/documents/components/DocumentsTable";
import { RemoveDialog } from "@/features/documents/components/RemoveDialog";

function DocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: docs, isLoading } = useDocuments();
  const { data: stats } = useStats();
  const inPipeline = useIngestStore((s) => s.jobIds.length);
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);

  const goIngest = () => navigate({ to: "/ingest" });

  return (
    <div className="scroll">
      <div className="page">
        <PageHead
          kicker="Manage / Documents"
          title="Documents"
          sub="Every source ingested into the knowledge base. Track parse status, chunk & pair counts, and re-ingest stale sources."
        >
          <Btn icon="upload" kind="pri" onClick={goIngest}>
            Ingest source
          </Btn>
        </PageHead>

        <div className="stats">
          <Stat k="Documents" v={stats?.docs ?? "—"} />
          <Stat k="Indexed chunks" v={stats ? stats.chunks.toLocaleString() : "—"} />
          <Stat k="Q/A pairs" v={stats ? stats.pairs.toLocaleString() : "—"} />
          <Stat k="In pipeline" v={inPipeline} />
        </div>

        {isLoading ? (
          <div
            style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}
          >
            Loading…
          </div>
        ) : !docs || docs.length === 0 ? (
          <EmptyPane
            icon="docs"
            title="No documents yet"
            desc="Ingest a source to build the knowledge base."
          />
        ) : (
          <DocumentsTable
            docs={docs}
            onOpen={(id) => navigate({ to: "/corpus", search: { doc: id } })}
            onIngest={goIngest}
            onRemove={(ids) => setRemoveIds(ids)}
          />
        )}
      </div>

      <RemoveDialog
        open={removeIds !== null}
        ids={removeIds ?? []}
        onClose={() => setRemoveIds(null)}
        onDone={() => {
          const n = removeIds?.length ?? 0;
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          queryClient.invalidateQueries({ queryKey: ["stats"] });
          toast.success(`Removed ${n} ${n === 1 ? "document" : "documents"}.`);
        }}
      />
    </div>
  );
}

export const Route = createFileRoute("/documents")({ component: DocumentsPage });
