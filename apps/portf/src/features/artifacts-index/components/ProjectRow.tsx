import { Link } from "@tanstack/react-router";
import type { ProjectGalleryItem } from "@/features/artifacts-index/data";

/**
 * Compact project row used in the "All" overview. Ported from the design
 * source's `ProjectRow` (artifacts-page.jsx:39-54). Wrapped in a
 * `<Link>` so the row is keyboard-focusable and behaves as navigation;
 * the `.artx-proj` rule supplies the cursor + hover indent.
 */
interface ProjectRowProps {
  p: ProjectGalleryItem;
}

export function ProjectRow({ p }: ProjectRowProps) {
  return (
    <Link to={p.href} className={"artx-proj"} aria-label={`Open project ${p.name}`}>
      <div className={"artx-proj-thumb" + (p.coral ? " coral" : "")}></div>
      <div className="artx-proj-main">
        <div className="artx-proj-name">
          <span>{p.name}</span>
          <span className="yr">{p.yr}</span>
          {p.live && <span className="live">live</span>}
        </div>
        <div className="artx-proj-tags">{p.tags}</div>
      </div>
      <span className="artx-proj-arrow">↗</span>
    </Link>
  );
}
