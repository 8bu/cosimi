import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface Props {
  descriptor: ArtifactDescriptor;
}

export function CvAction({ descriptor }: Props) {
  if (!descriptor.url) return null;
  return (
    <a className="artifact-action" href={descriptor.url} download>
      ↓ .PDF
    </a>
  );
}
