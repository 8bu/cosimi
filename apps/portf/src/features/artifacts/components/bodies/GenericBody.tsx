import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface Props {
  descriptor: ArtifactDescriptor;
}

export function GenericBody({ descriptor }: Props) {
  const { stack, Component } = descriptor;
  return (
    <div className="artifact-body is-misc">
      <Component />
      {stack.length > 0 && (
        <footer className="artifact-body-footer">
          <p className="artifact-body-stack kbd">{stack.join(" · ")}</p>
        </footer>
      )}
    </div>
  );
}
