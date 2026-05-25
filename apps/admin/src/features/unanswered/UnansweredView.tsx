import { useState } from "react";
import { Link } from "react-router";
import { Upload } from "lucide-react";
import { useUnanswered, type UnansweredSource } from "@/api/unanswered";
import { Button, buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { RelativeTime } from "@/components/RelativeTime";
import { SourceTabs } from "./SourceTabs";
import { TeachDialog } from "./TeachDialog";

const PAGE_SIZE = 50;

export function UnansweredView() {
  const [source, setSource] = useState<UnansweredSource>("all");
  const [page, setPage] = useState(0);
  const { data, isLoading } = useUnanswered({
    source,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const [teachOpen, setTeachOpen] = useState(false);
  const [teachInput, setTeachInput] = useState("");

  const items = data?.items ?? [];

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">Top unanswered</h1>
          <p className="text-sm text-muted-foreground">
            Questions chat users (or LLM pipelines) asked that the matcher couldn&apos;t answer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceTabs
            value={source}
            onChange={(s) => {
              setSource(s);
              setPage(0);
            }}
          />
          <Link to="/import" className={buttonVariants({ variant: "outline" })}>
            <Upload className="size-4 mr-2" /> Import
          </Link>
        </div>
      </header>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Input</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium text-right">Count</th>
              <th className="px-4 py-2 font-medium">Last seen</th>
              <th className="px-4 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">{row.input}</td>
                <td className="px-4 py-3 text-muted-foreground uppercase text-xs tracking-wide">
                  {row.source}
                </td>
                <td className="px-4 py-3 text-right font-medium">{row.count}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <RelativeTime when={row.last_seen} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTeachInput(row.input);
                      setTeachOpen(true);
                    }}
                  >
                    Teach
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(page > 0 || items.length === PAGE_SIZE) && (
        <Pagination page={page} hasMore={items.length === PAGE_SIZE} onChange={setPage} />
      )}

      <TeachDialog open={teachOpen} onOpenChange={setTeachOpen} input={teachInput} />
    </section>
  );
}
