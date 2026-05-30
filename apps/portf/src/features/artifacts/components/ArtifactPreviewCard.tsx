import type { KeyboardEvent } from "react";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

export interface ArtifactPreviewCardProps {
  descriptor: ArtifactDescriptor;
  onOpen: (descriptor: ArtifactDescriptor) => void;
}

/**
 * Verbatim port of the V1FirstChat card shape from
 * docs/superpowers/artifacts/cosimi2/project/flow-and-pages.jsx:144-164.
 *
 * Renders the bordered card (thumb + kicker + title + stack + arrow) followed
 * by the below-card kbd hint, both inside a fragment so the parent bubble flow
 * stacks them: text -> card -> hint.
 */
export function ArtifactPreviewCard({ descriptor, onOpen }: ArtifactPreviewCardProps) {
  function handleKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(descriptor);
    }
  }

  return (
    <>
      <div
        className="artifact-preview-card"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(descriptor)}
        onKeyDown={handleKey}
        aria-label={`Open artifact: ${descriptor.title}`}
      >
        {descriptor.thumb ? (
          <img className="artifact-preview-card-thumb" src={descriptor.thumb} alt="" />
        ) : (
          <div className="artifact-preview-card-thumb artifact-preview-card-thumb-fallback">
            <span>{descriptor.kind.toUpperCase()}</span>
          </div>
        )}
        <div className="artifact-preview-card-body">
          <div className="artifact-preview-card-kicker">↗ {descriptor.kicker}</div>
          <div className="artifact-preview-card-title">
            {descriptor.title} · {descriptor.period}
          </div>
          <div className="artifact-preview-card-stack">{descriptor.stack.join(" · ")}</div>
        </div>
        <span className="artifact-preview-card-arrow">→</span>
      </div>
      <div className="artifact-preview-card-hint kbd">tap to open it on the right →</div>
    </>
  );
}
