/**
 * MDX module declaration.
 *
 * Each .mdx file becomes an ESM module exporting:
 *  - default: a React component (the rendered MDX body)
 *  - frontmatter: the parsed YAML block (named export via remark-mdx-frontmatter)
 *
 * The `unknown` type on frontmatter is deliberate; the catalog loader at
 * `apps/portf/src/features/artifacts/catalog.ts` validates against a valibot
 * schema and narrows to `Frontmatter`.
 */
declare module "*.mdx" {
  import type { ComponentType } from "react";

  export const frontmatter: Record<string, unknown>;
  const Component: ComponentType;
  export default Component;
}
