import { Link } from "@tanstack/react-router";
import type { ProjectGalleryItem } from "@/features/artifacts-index/data";

/**
 * Expanded project card used in the "Projects" filter view. Ported from
 * the design source's `ProjectCard` (artifacts-page.jsx:69-89).
 */
interface ProjectCardProps {
  p: ProjectGalleryItem;
}

export function ProjectCard({ p }: ProjectCardProps) {
  return (
    <Link to={p.href} className="artx-card" aria-label={`Open project ${p.name}`}>
      <div className={"artx-card-thumb" + (p.coral ? " coral" : "")}>
        <span className="artx-card-thumb-label">{p.live ? "live preview" : "case study"}</span>
        {p.live && <span className="artx-card-live">live</span>}
      </div>
      <div className="artx-card-body">
        <div className="artx-card-name">
          <span>{p.name}</span>
          <span className="yr">{p.yr}</span>
        </div>
        <p className="artx-card-desc">{p.desc}</p>
        <div className="artx-card-foot">
          <span className="artx-card-tags">{p.tags}</span>
          <span className="artx-card-open">↗ open</span>
        </div>
      </div>
    </Link>
  );
}
