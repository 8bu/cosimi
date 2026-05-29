import type { ArtifactDescriptor } from "@/features/artifacts/types";

interface Props {
  descriptor: ArtifactDescriptor;
}

function hostPlusPath(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.replace(/^\/|\/$/g, "");
    return tail ? `${u.hostname}/${tail}` : u.hostname;
  } catch {
    return url;
  }
}

export function ProjectAction({ descriptor }: Props) {
  const { url, repo } = descriptor;
  if (!url && !repo) return null;
  return (
    <>
      {url && (
        <a className="artifact-action" href={url} target="_blank" rel="noopener noreferrer">
          ↗ {hostPlusPath(url)}
        </a>
      )}
      {repo && (
        <a
          className="artifact-action artifact-action-secondary"
          href={repo}
          target="_blank"
          rel="noopener noreferrer"
        >
          ↗ {hostPlusPath(repo)}
        </a>
      )}
    </>
  );
}
