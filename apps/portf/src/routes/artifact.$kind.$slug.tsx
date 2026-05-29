import { createFileRoute, notFound } from "@tanstack/react-router";

import { getDescriptor } from "@/features/artifacts/catalog";
import { ArtifactPane } from "@/features/artifacts/components/ArtifactPane";
import type { ArtifactKind } from "@/features/artifacts/types";
import { MobileBurger } from "@/features/sidebar/components/MobileBurger";
import { Sidebar } from "@/features/sidebar/components/Sidebar";

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

/**
 * Standalone artifact pane (cold-landed share link, etc.). Wrapped in
 * `.artifacts-shell` + `<Sidebar />` so mobile users can reach the
 * thread list / gallery without getting stranded inside a single
 * artifact. The `.mobile-topbar` row exposes the burger; layout.css's
 * `@media (max-width: 768px)` rule hides it on desktop.
 */
function ArtifactStandalone() {
  const { descriptor } = Route.useLoaderData();
  return (
    <section className="artifacts-shell">
      <Sidebar />
      <div className="artifacts-main">
        <div className="mobile-topbar">
          <MobileBurger />
        </div>
        <ArtifactPane descriptor={descriptor} />
      </div>
    </section>
  );
}
