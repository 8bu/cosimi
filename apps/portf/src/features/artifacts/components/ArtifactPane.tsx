import type { ReactNode } from "react";

import { ArtifactPanel } from "@/features/artifacts/components/ArtifactPanel";
import { ProjectBody } from "@/features/artifacts/components/bodies/ProjectBody";
import { EssayBody } from "@/features/artifacts/components/bodies/EssayBody";
import { CvBody } from "@/features/artifacts/components/bodies/CvBody";
import { GenericBody } from "@/features/artifacts/components/bodies/GenericBody";
import { ProjectAction } from "@/features/artifacts/components/actions/ProjectAction";
import { EssayAction } from "@/features/artifacts/components/actions/EssayAction";
import { CvAction } from "@/features/artifacts/components/actions/CvAction";
import { useArtifactScrollRestore } from "@/features/artifacts/hooks/useArtifactScrollRestore";
import { useCloseArtifact } from "@/features/artifacts/hooks/useCloseArtifact";
import { useOpenerFocusRestore } from "@/features/artifacts/hooks/useOpenerFocusRestore";
import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface Props {
  descriptor: ArtifactDescriptor;
}

function kickerFor(d: ArtifactDescriptor): string {
  switch (d.kind) {
    case "projects":
      return `ARTIFACT · ${d.title} · ${d.period}`;
    case "essays":
      return `ESSAY · ${d.period}`;
    case "resume":
      return `CV · ${d.title} · UPDATED ${d.period}`;
    case "misc":
      return d.title;
  }
}

function bodyFor(d: ArtifactDescriptor): ReactNode {
  switch (d.kind) {
    case "projects":
      return <ProjectBody descriptor={d} />;
    case "essays":
      return <EssayBody descriptor={d} />;
    case "resume":
      return <CvBody descriptor={d} />;
    case "misc":
      return <GenericBody descriptor={d} />;
  }
}

function actionFor(d: ArtifactDescriptor): ReactNode {
  switch (d.kind) {
    case "projects":
      return <ProjectAction descriptor={d} />;
    case "essays":
      return <EssayAction />;
    case "resume":
      return <CvAction descriptor={d} />;
    case "misc":
      return null;
  }
}

/**
 * Public artifact-pane component. Picks per-kind body + action via descriptor.kind,
 * computes the kicker string, wires onClose to useCloseArtifact. CSS-only
 * desktop-split vs mobile-fullscreen swap (see layout.css).
 */
export function ArtifactPane({ descriptor }: Props) {
  const restoreOpenerFocus = useOpenerFocusRestore();
  const { close } = useCloseArtifact(restoreOpenerFocus);
  const bodyRef = useArtifactScrollRestore(descriptor.slug);
  return (
    <ArtifactPanel
      bodyRef={bodyRef}
      kicker={kickerFor(descriptor)}
      title={descriptor.title}
      meta={descriptor.summary || undefined}
      action={actionFor(descriptor)}
      onClose={close}
    >
      {bodyFor(descriptor)}
    </ArtifactPanel>
  );
}
