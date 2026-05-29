import type { ComponentType } from "react";
import * as v from "valibot";

/**
 * Artifact taxonomy. Kind lives in the parent directory of each .mdx file
 * (e.g. apps/portf/src/artifacts/projects/wegopro.mdx -> kind = "projects").
 * The frontmatter MAY echo kind for editor self-documentation, but the
 * loader trusts the directory and throws on mismatch.
 */
export type ArtifactKind = "projects" | "essays" | "resume" | "misc";

/**
 * Frontmatter schema (valibot). What an MDX author writes inside ---...---.
 *
 *   slug:           globally unique, lowercase + digits + hyphens only
 *   kind:           must match parent directory; loader validates
 *   title:          display title
 *   kicker:         coral mono row text inside the card; default "open artifact"
 *   period:         human-readable period; en-dash allowed for date ranges
 *   stack:          list of tech labels (rendered mono, joined)
 *   summary:        1-2 sentence blurb; rendered in Phase G pane, not the card
 *   thumb:          optional image path; null -> fallback PhBlock-style block
 *   matchPatterns:  case-insensitive substrings the matcher checks against user input
 *   locale:         BCP-47 code; default "en"
 *   order:          sort key within kind (0 first); default 0
 */
export const FrontmatterSchema = v.object({
  slug: v.pipe(v.string(), v.minLength(1), v.regex(/^[a-z0-9-]+$/)),
  kind: v.picklist(["projects", "essays", "resume", "misc"]),
  title: v.pipe(v.string(), v.minLength(1)),
  kicker: v.optional(v.string(), "open artifact"),
  period: v.string(),
  stack: v.array(v.string()),
  summary: v.string(),
  thumb: v.optional(v.nullable(v.string()), null),
  matchPatterns: v.array(v.pipe(v.string(), v.minLength(2))),
  locale: v.optional(v.string(), "en"),
  order: v.optional(v.number(), 0),
  url: v.optional(v.string()),
  repo: v.optional(v.string()),
});

export type Frontmatter = v.InferOutput<typeof FrontmatterSchema>;

/**
 * Runtime descriptor: frontmatter + path-derived kind/slug pair + the MDX
 * default-export React component (for Phase G pane rendering).
 *
 * The `kind` field is authoritative from the file path. `Component` is the
 * MDX body; Phase F never renders it (the preview card uses descriptor
 * metadata only); Phase G consumes it inside <ArtifactPane>.
 */
export interface ArtifactDescriptor {
  kind: ArtifactKind;
  slug: string;
  title: string;
  kicker: string;
  period: string;
  stack: string[];
  summary: string;
  thumb: string | null;
  matchPatterns: string[];
  locale: string;
  order: number;
  url?: string;
  repo?: string;
  Component: ComponentType<{ components?: Record<string, ComponentType<any>> }>;
}
