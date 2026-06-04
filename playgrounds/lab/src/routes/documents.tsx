import { createFileRoute } from "@tanstack/react-router";
import { DocumentsTable } from "@/features/documents/components/DocumentsTable";

export const Route = createFileRoute("/documents")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
      <DocumentsTable />
    </div>
  ),
});
