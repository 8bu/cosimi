import { Link } from "@tanstack/react-router";
import type { EssayGalleryItem } from "@/features/artifacts-index/data";

/**
 * Expanded essay row used in the "Writing" filter view. Ported from the
 * design source's `EssayCard` (artifacts-page.jsx:92-104).
 */
interface EssayCardProps {
  e: EssayGalleryItem;
}

export function EssayCard({ e }: EssayCardProps) {
  return (
    <Link to={e.href} className="artx-essay artx-essay-lg" aria-label={`Open essay ${e.title}`}>
      <span className="artx-essay-num">{e.n}</span>
      <div className="artx-essay-main">
        <div className="artx-essay-title" style={{ fontSize: 17 }}>
          {e.title}
        </div>
        <p className="artx-essay-dek">{e.dek}</p>
        <div className="artx-essay-meta">{e.meta}</div>
      </div>
      <span className="artx-proj-arrow">↗</span>
    </Link>
  );
}
