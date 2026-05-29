import { Link } from "@tanstack/react-router";
import type { ResumeGalleryItem } from "@/features/artifacts-index/data";

/**
 * Full inline résumé for the "CV" filter view. Shape ported from the
 * design source's `CVDetail` (artifacts-page.jsx:107-151). Title +
 * period come from the resume descriptor; the experience / stack /
 * AI-workflow blocks mirror the design source's hard-coded arrays with
 * content swapped in from `apps/portf/public/longnguyen-2026.pdf` page
 * 2 (companies + roles, not from the MDX body — the standalone
 * `/artifact/resume/longnguyen-2026` route still owns that).
 */
interface CvDetailProps {
  resume: ResumeGalleryItem;
}

interface ExpRow {
  co: string;
  when: string;
  role: string;
}

const EXPERIENCE: ExpRow[] = [
  { co: "WegoPro", when: "2022 - 2026", role: "Web Developer · B2B travel & expense, remote" },
  { co: "BlockDevs / Multiplier", when: "2019 - 2022", role: "Front-end · DeFi protocols (HCMC)" },
  { co: "Motorist.sg", when: "2017 - 2019", role: "Front-end · auto-services SaaS (HCMC)" },
  { co: "Letterink", when: "2016 - 2017", role: "Front-end · custom CMS (HCMC)" },
  { co: "Freelance", when: "2013 - 2016", role: "Front-end · agency + product work (HCMC)" },
];

export function CvDetail({ resume }: CvDetailProps) {
  return (
    <div className="artx-cv-detail">
      <div className="artx-cv-detail-head">
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "-0.018em",
            }}
          >
            Long NGUYỄN
          </div>
          <div className="kbd" style={{ marginTop: 4 }}>
            Web Developer · product-minded · 10+ yrs · hvanlong@pm.me
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Link
            to={resume.href}
            className="artifact-action artifact-action-secondary"
            aria-label="Open full résumé page"
          >
            ↗ open full
          </Link>
          {resume.url && (
            <a
              href={resume.url}
              download
              className="artifact-action"
              aria-label="Download résumé PDF"
            >
              ↓ {resume.title}
            </a>
          )}
        </div>
      </div>
      <div className="artx-cv-detail-grid">
        <div>
          <div className="artx-col-label" style={{ margin: "0 0 6px" }}>
            <span>Experience</span>
          </div>
          {EXPERIENCE.map((x) => (
            <div key={x.co} className="artx-cv-exp">
              <span className="when">{x.when}</span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12.5 }}>
                  {x.co}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 10.5,
                    color: "var(--ink-3)",
                  }}
                >
                  {x.role}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="artx-col-label" style={{ margin: "0 0 6px" }}>
            <span>Stack</span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: 1.7,
              color: "var(--ink-2)",
            }}
          >
            TypeScript · Vue / Nuxt ·<br />
            React / Next · Tailwind ·<br />
            SCSS · Pinia / Vuex · Web3.js
          </div>
          <div className="artx-col-label" style={{ margin: "14px 0 6px" }}>
            <span>AI workflow</span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: 1.7,
              color: "var(--ink-2)",
            }}
          >
            Claude Code · Codex ·<br />
            Cursor · Ollama
          </div>
        </div>
      </div>
    </div>
  );
}
