import { createFileRoute } from "@tanstack/react-router";
import { IngestForm } from "@/features/ingest/components/IngestForm";

export const Route = createFileRoute("/ingest")({
  component: () => <IngestForm />,
});
