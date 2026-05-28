import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface Props {
  descriptor: ArtifactDescriptor;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function ProjectAction({ descriptor }: Props) {
  if (!descriptor.url) return null;
  return (
    <a className="artifact-action" href={descriptor.url} target="_blank" rel="noopener noreferrer">
      ↗ {hostname(descriptor.url)}
    </a>
  );
}
