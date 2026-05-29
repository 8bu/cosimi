import { Link } from "@tanstack/react-router";
import type { EssayGalleryItem } from "@/features/artifacts-index/data";

/**
 * Compact essay row used in the "All" overview. Ported from the design
 * source's `EssayRow` (artifacts-page.jsx:56-66).
 */
interface EssayRowProps {
  e: EssayGalleryItem;
}

export function EssayRow({ e }: EssayRowProps) {
  return (
    <Link to={e.href} className="artx-essay" aria-label={`Open essay ${e.title}`}>
      <span className="artx-essay-num">{e.n}</span>
      <div className="artx-essay-main">
        <div className="artx-essay-title">{e.title}</div>
        <div className="artx-essay-meta">{e.meta}</div>
      </div>
    </Link>
  );
}
