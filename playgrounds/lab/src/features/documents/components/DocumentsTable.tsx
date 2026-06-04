import { Link } from "@tanstack/react-router";
import { Trash } from "@phosphor-icons/react";
import { useDeleteDocument, useDocuments } from "../hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function DocumentsTable() {
  const { data, isLoading } = useDocuments();
  const del = useDeleteDocument();
  if (isLoading)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  if (!data || data.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No documents ingested yet.
        </CardContent>
      </Card>
    );
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="w-24">Chunks</TableHead>
            <TableHead className="w-24">Pairs</TableHead>
            <TableHead className="w-40">Created</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <Link
                  to="/corpus"
                  search={{ doc: d.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {d.title}
                </Link>
              </TableCell>
              <TableCell>{d.chunkCount}</TableCell>
              <TableCell>{d.pairCount}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(d.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <ConfirmDialog
                  title="Delete document?"
                  description={
                    <>
                      Permanently removes <strong>{d.title}</strong> — its {d.chunkCount} chunks and{" "}
                      {d.pairCount} generated pairs. This cannot be undone.
                    </>
                  }
                  onConfirm={() => del.mutate(d.id)}
                  pending={del.isPending}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${d.title}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash />
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
