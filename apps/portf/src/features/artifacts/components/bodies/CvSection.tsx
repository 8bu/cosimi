import type { ReactNode } from "react";

interface Props {
  col: "left" | "right";
  children: ReactNode;
}

/**
 * MDX-scope component used inside longnguyen-2026.mdx to wrap left/right
 * columns of the 2fr/1fr CV grid. CvBody injects this into the MDX
 * components map so the MDX author writes:
 *
 *   <CvSection col="left">
 *   ## EXPERIENCE
 *   ...
 *   </CvSection>
 *
 * CSS in layout.css `.artifact-body.is-resume` (lands in Task 6) arranges
 * the columns via grid.
 */
export function CvSection({ col, children }: Props) {
  return <section className={`cv-section is-${col}`}>{children}</section>;
}
