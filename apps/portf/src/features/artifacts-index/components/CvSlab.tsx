import type { ResumeGalleryItem } from "@/features/artifacts-index/data";

/**
 * Small CV slab in the right column of the "All" view. Ported from the
 * design source's CV block in `ArtifactsGallery` (artifacts-page.jsx:
 * 194-205). The download button is a real `<a download>` tag so the
 * browser handles the file save - no JS required.
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
      <div className="artx-cv-row">
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
          >
            ↓ .PDF
          </a>
        )}
      </div>
    </div>
  );
}
