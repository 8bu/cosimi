import type { ArtifactDescriptor } from "@/features/artifacts/types";
import { CvSection } from "@/features/artifacts/components/bodies/CvSection";

interface Props {
  descriptor: ArtifactDescriptor;
}

const mdxComponents = { CvSection };

export function CvBody({ descriptor }: Props) {
  const { stack, Component } = descriptor;
  return (
    <div className="artifact-body is-resume">
      <Component components={mdxComponents} />
      {stack.length > 0 && (
        <footer className="artifact-body-footer">
          <p className="artifact-body-stack kbd">{stack.join(" · ")}</p>
        </footer>
      )}
    </div>
  );
}
