import { createFileRoute, notFound } from "@tanstack/react-router";

import { getDescriptor } from "@/features/artifacts/catalog";
import { ArtifactPane } from "@/features/artifacts/components/ArtifactPane";
import type { ArtifactKind } from "@/features/artifacts/types";

interface LoaderArgs {
  params: { kind: string; slug: string };
}

const VALID_KINDS: readonly ArtifactKind[] = ["projects", "essays", "resume", "misc"];

export const Route = createFileRoute("/artifact/$kind/$slug")({
  loader: ({ params }: LoaderArgs) => {
    if (!VALID_KINDS.includes(params.kind as ArtifactKind)) throw notFound();
    const descriptor = getDescriptor(params.slug);
    if (!descriptor) throw notFound();
    if (descriptor.kind !== params.kind) throw notFound();
    return { descriptor };
  },
  component: ArtifactStandalone,
});

function ArtifactStandalone() {
  const { descriptor } = Route.useLoaderData();
  return <ArtifactPane descriptor={descriptor} />;
}
