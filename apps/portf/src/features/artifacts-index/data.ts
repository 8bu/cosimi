import { getCatalog } from "@/features/artifacts/catalog";
import type { ArtifactDescriptor } from "@/features/artifacts/types";

/**
 * Gallery row shapes - rendered by the artifacts-index components. These
 * are derived from the catalog descriptors; the gallery does NOT mount
 * the MDX `Component` (that's the standalone /artifact/$kind/$slug
 * route's job). Anything the components read MUST appear on these shapes.
 */
export interface ProjectGalleryItem {
  slug: string;
  name: string;
  yr: string;
  live: boolean;
  tags: string;
  desc: string;
  coral: boolean;
  href: string;
}

export interface EssayGalleryItem {
  slug: string;
  n: string;
  title: string;
  meta: string;
  dek: string;
  href: string;
}

export interface ResumeGalleryItem {
  slug: string;
  title: string;
  period: string;
  summary: string;
  url: string | null;
  href: string;
}

function mapProject(d: ArtifactDescriptor): ProjectGalleryItem {
  return {
    slug: d.slug,
    name: d.title,
    yr: d.period,
    live: !!d.url,
    tags: d.stack.join(" · "),
    desc: d.summary,
    coral: d.order === 1,
    href: `/artifact/${d.kind}/${d.slug}`,
  };
}

function mapEssay(d: ArtifactDescriptor): EssayGalleryItem {
  return {
    slug: d.slug,
    n: String(d.order).padStart(2, "0"),
    title: d.title,
    meta: `${d.period} · essay`,
    dek: d.summary,
    href: `/artifact/${d.kind}/${d.slug}`,
  };
}

function mapResume(d: ArtifactDescriptor): ResumeGalleryItem {
  return {
    slug: d.slug,
    title: d.title,
    period: d.period,
    summary: d.summary,
    url: d.url ?? null,
    href: `/artifact/${d.kind}/${d.slug}`,
  };
}

/**
 * Catalog reader split by kind. Misc descriptors stay chat-only - the
 * design source's filters are All / Projects / Writing / CV; misc never
 * surfaces in the gallery. `getCatalog()` returns descriptors sorted by
 * (kind, order, title) so caller-side order is stable.
 */
export function projectsForGallery(): ProjectGalleryItem[] {
  return getCatalog()
    .filter((d) => d.kind === "projects")
    .map(mapProject);
}

export function essaysForGallery(): EssayGalleryItem[] {
  return getCatalog()
    .filter((d) => d.kind === "essays")
    .map(mapEssay);
}

export function resumeForGallery(): ResumeGalleryItem | null {
  const resume = getCatalog().find((d) => d.kind === "resume");
  return resume ? mapResume(resume) : null;
}

export function totalGalleryItems(): number {
  return projectsForGallery().length + essaysForGallery().length + (resumeForGallery() ? 1 : 0);
}
