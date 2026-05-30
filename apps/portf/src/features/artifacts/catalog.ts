import * as v from "valibot";

import {
  FrontmatterSchema,
  type ArtifactDescriptor,
  type ArtifactKind,
} from "@/features/artifacts/types";

/**
 * MDX module shape produced by @mdx-js/rollup + remark-mdx-frontmatter:
 *   default:     React component for the MDX body
 *   frontmatter: parsed YAML block (unknown shape; validated by valibot)
 */
interface MdxModule {
  default: ArtifactDescriptor["Component"];
  frontmatter: Record<string, unknown>;
}

const PATH_RE = /\/artifacts\/(__fixtures__\/)?(projects|essays|resume|misc)\/[^/]+\.mdx$/;
const VALID_KINDS: readonly ArtifactKind[] = ["projects", "essays", "resume", "misc"];

function parsePath(path: string): { kind: ArtifactKind; isFixture: boolean } | null {
  const m = PATH_RE.exec(path);
  if (!m) return null;
  return { kind: m[2] as ArtifactKind, isFixture: m[1] !== undefined };
}

/**
 * Pure builder. Tests pass synthetic module records; production calls
 * `import.meta.glob` and forwards the result here.
 */
export function _buildCatalog(
  modules: Record<string, MdxModule>,
  options: { excludeFixtures?: boolean } = {},
): Map<string, ArtifactDescriptor> {
  const catalog = new Map<string, ArtifactDescriptor>();

  for (const [path, mod] of Object.entries(modules)) {
    const parsed = parsePath(path);
    if (!parsed) {
      throw new Error(`[portf catalog] cannot parse kind/slug from path: ${path}`);
    }
    if (parsed.isFixture && options.excludeFixtures) continue;

    let fm;
    try {
      fm = v.parse(FrontmatterSchema, mod.frontmatter);
    } catch (err) {
      throw new Error(
        `[portf catalog] frontmatter validation failed for ${path}: ${(err as Error).message}`,
        { cause: err },
      );
    }

    if (fm.kind !== parsed.kind) {
      throw new Error(
        `[portf catalog] kind mismatch in ${path}: frontmatter says '${fm.kind}', directory says '${parsed.kind}'`,
      );
    }

    if (catalog.has(fm.slug)) {
      throw new Error(`[portf catalog] duplicate slug '${fm.slug}' (second occurrence: ${path})`);
    }

    catalog.set(fm.slug, {
      kind: fm.kind,
      slug: fm.slug,
      title: fm.title,
      kicker: fm.kicker,
      period: fm.period,
      stack: fm.stack,
      summary: fm.summary,
      thumb: fm.thumb,
      matchPatterns: fm.matchPatterns,
      locale: fm.locale,
      order: fm.order,
      url: fm.url,
      repo: fm.repo,
      Component: mod.default,
    });
  }

  return catalog;
}

// Lazy-initialized at first use of the public API. Tests can swap via
// _setCatalogForTesting; production initializes from import.meta.glob.
let _catalog: Map<string, ArtifactDescriptor> | null = null;

function ensureCatalog(): Map<string, ArtifactDescriptor> {
  if (_catalog) return _catalog;

  // Production glob - Vite resolves at build time.
  const modules = import.meta.glob<MdxModule>("../../artifacts/**/*.mdx", { eager: true });
  _catalog = _buildCatalog(modules, { excludeFixtures: true });
  return _catalog;
}

/**
 * All descriptors sorted by (kind, order, title). Phase G's catalog index
 * route consumes this; Phase F's matchArtifact also uses it.
 */
export function getCatalog(): ArtifactDescriptor[] {
  const all = Array.from(ensureCatalog().values());
  all.sort((a, b) => {
    if (a.kind !== b.kind) return VALID_KINDS.indexOf(a.kind) - VALID_KINDS.indexOf(b.kind);
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
  return all;
}

export function getDescriptor(slug: string): ArtifactDescriptor | null {
  return ensureCatalog().get(slug) ?? null;
}

/** Test-only: replace the singleton. Production code MUST NOT call this. */
export function _setCatalogForTesting(next: Map<string, ArtifactDescriptor>): void {
  _catalog = next;
}
