import { useMemo, useState } from "react";
import {
  projectsForGallery,
  essaysForGallery,
  resumeForGallery,
  totalGalleryItems,
} from "@/features/artifacts-index/data";
import { ProjectRow } from "@/features/artifacts-index/components/ProjectRow";
import { EssayRow } from "@/features/artifacts-index/components/EssayRow";
import { ProjectCard } from "@/features/artifacts-index/components/ProjectCard";
import { EssayCard } from "@/features/artifacts-index/components/EssayCard";
import { CvSlab } from "@/features/artifacts-index/components/CvSlab";
import { CvDetail } from "@/features/artifacts-index/components/CvDetail";

type Filter = "All" | "Projects" | "Writing" | "CV";

const FILTERS: Filter[] = ["All", "Projects", "Writing", "CV"];

const SUB_BY_ID: Record<Filter, string> = {
  All: "Every project, essay, and the CV - the same artifacts the chat opens, laid out so you can skim them all at once.",
  Projects:
    "Shipped products across B2B SaaS, DeFi, and consumer web. Open any one to dig into the build.",
  Writing: "Essays and field notes from the work - migrations, Web3, and design-system upkeep.",
  CV: "The whole résumé as one artifact. Download it, or just read it here.",
};

/**
 * Top-level gallery component. Reads the catalog through the
 * `artifacts-index/data` helpers (no descriptors leak past that
 * boundary) and renders the design source's index page layout under
 * `/artifacts`.
 *
 * Filter state is local React state - this view is a hub, not a deep
 * link target. If we ever want shareable filter URLs we can promote
 * to `useSearch`.
 */
export function ArtifactsGallery() {
  const projects = useMemo(() => projectsForGallery(), []);
  const essays = useMemo(() => essaysForGallery(), []);
  const resume = useMemo(() => resumeForGallery(), []);
  const total = useMemo(() => totalGalleryItems(), []);
  const [filter, setFilter] = useState<Filter>("All");

  const projectCount = String(projects.length).padStart(2, "0");
  const essayCount = String(essays.length).padStart(2, "0");

  return (
    <div className="artx">
      <div className="artx-head">
        <div>
          <span className="kbd" style={{ color: "var(--coral)" }}>
            ↗ ARTIFACTS · {total} ITEMS
          </span>
          <h1 className="artx-title">
            Everything,
            <br />
            in one place.
          </h1>
          <p className="artx-sub">{SUB_BY_ID[filter]}</p>
        </div>
        <div className="artx-filters" role="tablist" aria-label="Artifact category filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={"artx-filter" + (filter === f ? " active" : "")}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filter === "All" && (
        <div className="artx-body">
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div className="artx-col-label">
              <span>Projects</span>
              <span className="n">{projectCount}</span>
            </div>
            {projects.map((p) => (
              <ProjectRow key={p.slug} p={p} />
            ))}
          </div>
          <div
            style={{
              minWidth: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="artx-col-label">
              <span>Writing</span>
              <span className="n">{essayCount}</span>
            </div>
            {essays.map((e) => (
              <EssayRow key={e.slug} e={e} />
            ))}
            {resume && <CvSlab resume={resume} />}
          </div>
        </div>
      )}

      {filter === "Projects" && (
        <div className="artx-single">
          <div className="artx-card-grid">
            {projects.map((p) => (
              <ProjectCard key={p.slug} p={p} />
            ))}
          </div>
        </div>
      )}

      {filter === "Writing" && (
        <div className="artx-single">
          {essays.map((e) => (
            <EssayCard key={e.slug} e={e} />
          ))}
        </div>
      )}

      {filter === "CV" && (
        <div className="artx-single">{resume && <CvDetail resume={resume} />}</div>
      )}

      <div className="artx-fade"></div>
    </div>
  );
}
