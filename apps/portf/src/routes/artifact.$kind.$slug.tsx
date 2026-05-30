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

/**
 * Loader returns lookup keys only — NOT the descriptor object. The descriptor
 * carries a React Component (the MDX body) which TanStack Start's Seroval
 * serializer cannot transfer from server to client. Both `head()` and
 * `ArtifactStandalone` re-resolve the descriptor via `getDescriptor()`; the
 * catalog is statically materialized at build time (Vite `import.meta.glob`
 * eager), so the second lookup costs nothing.
 */
export const Route = createFileRoute("/artifact/$kind/$slug")({
  loader: ({ params }: LoaderArgs) => {
    if (!VALID_KINDS.includes(params.kind as ArtifactKind)) throw notFound();
    const descriptor = getDescriptor(params.slug);
    if (!descriptor) throw notFound();
    if (descriptor.kind !== params.kind) throw notFound();
    return { kind: descriptor.kind, slug: descriptor.slug };
  },
  head: ({ params }: { params?: { kind: string; slug: string } }) => {
    if (!params) return {};
    const d = getDescriptor(params.slug);
    if (!d || d.kind !== params.kind) return {};
    const titleStr = `${d.title} - ${d.kind} | Long NGUYỄN`;
    return {
      meta: [
        { title: titleStr },
        { name: "description", content: d.summary },
        { property: "og:title", content: titleStr },
        { property: "og:description", content: d.summary },
        { property: "og:image", content: `/og/${d.slug}.png` },
        { property: "og:type", content: "article" },
      ],
      links: [
        {
          rel: "canonical",
          href: `https://8bu.dev/artifact/${d.kind}/${d.slug}`,
        },
      ],
    };
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
  const { slug } = Route.useParams();
  const descriptor = getDescriptor(slug);
  if (!descriptor) throw notFound();
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
