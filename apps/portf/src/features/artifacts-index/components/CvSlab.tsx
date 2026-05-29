import { Link } from "@tanstack/react-router";
import type { ResumeGalleryItem } from "@/features/artifacts-index/data";

/**
 * Small CV slab in the right column of the "All" view. Ported from the
 * design source's CV block in `ArtifactsGallery` (artifacts-page.jsx:
 * 194-205). The slab is a `<Link>` to the standalone resume route so
 * clicking the body opens the full résumé; the .PDF anchor stops
 * propagation so it triggers a download instead of navigating.
 */
interface CvSlabProps {
  resume: ResumeGalleryItem;
}

export function CvSlab({ resume }: CvSlabProps) {
  return (
    <div className="artx-cv">
      <div className="artx-col-label" style={{ margin: 0, marginBottom: 8 }}>
        <span>Curriculum Vitae</span>
        <span className="n">01</span>
      </div>
      <Link to={resume.href} className="artx-cv-row" aria-label={`Open résumé ${resume.title}`}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13 }}>
            Long NGUYỄN - 2026
          </div>
          <div className="kbd" style={{ marginTop: 3, color: "var(--ink-4)" }}>
            {resume.title} · {resume.period}
          </div>
        </div>
        {resume.url && (
          <a
            href={resume.url}
            download
            className="artifact-action"
            aria-label="Download résumé PDF"
            onClick={(e) => e.stopPropagation()}
          >
            ↓ .PDF
          </a>
        )}
      </Link>
    </div>
  );
}
