import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface Props {
  descriptor: ArtifactDescriptor;
}

export function GenericBody({ descriptor }: Props) {
  const { stack, Component } = descriptor;
  return (
    <>
      {stack.length > 0 && (
        <header className="artifact-body-header">
          <p className="artifact-body-stack kbd">{stack.join(" · ")}</p>
        </header>
      )}
      <div className="artifact-body is-misc">
        <Component />
      </div>
    </>
  );
}
