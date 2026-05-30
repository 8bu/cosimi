import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist", "client");
const ARTIFACTS_DIR = join(ROOT, "src", "artifacts");
const ARTIFACT_KINDS = ["projects", "essays", "resume", "misc"] as const;

interface DescriptorRef {
  kind: string;
  slug: string;
}

/**
 * Discover (kind, slug) tuples from MDX frontmatter via fs - mirrors
 * the script in `scripts/generate-og.ts`. Keeps this test independent
 * of the catalog loader (which depends on `import.meta.glob`).
 */
function discoverDescriptors(): DescriptorRef[] {
  const out: DescriptorRef[] = [];
  for (const kind of ARTIFACT_KINDS) {
    const dir = join(ARTIFACTS_DIR, kind);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".mdx")) continue;
      const text = readFileSync(join(dir, file), "utf-8");
      const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) continue;
      const slugMatch = m[1].match(/^slug:\s*(.+)$/m);
      if (!slugMatch) continue;
      const slug = slugMatch[1].trim().replace(/^["']|["']$/g, "");
      out.push({ kind, slug });
    }
  }
  return out;
}

beforeAll(() => {
  execSync("pnpm build", { cwd: ROOT, stdio: "inherit" });
}, 180_000);

describe("SSG output", () => {
  it("emits home + gallery HTML", () => {
    expect(existsSync(join(DIST, "index.html"))).toBe(true);
    expect(existsSync(join(DIST, "artifacts/index.html"))).toBe(true);
  });

  it("emits per-descriptor HTML for each catalog entry", () => {
    const refs = discoverDescriptors();
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const path = join(DIST, "artifact", ref.kind, ref.slug, "index.html");
      expect(existsSync(path), `missing ${path}`).toBe(true);
    }
  });

  it("emits chat shell (SPA fallback target)", () => {
    expect(existsSync(join(DIST, "chat/index.html"))).toBe(true);
  });

  it("emits og:image per descriptor + default", () => {
    expect(existsSync(join(DIST, "og/default.png"))).toBe(true);
    const refs = discoverDescriptors();
    for (const ref of refs) {
      expect(existsSync(join(DIST, "og", `${ref.slug}.png`)), `missing og/${ref.slug}.png`).toBe(
        true,
      );
    }
  });

  it("emits sitemap.xml with prerendered URL set", () => {
    const path = join(DIST, "sitemap.xml");
    expect(existsSync(path)).toBe(true);
    const sitemap = readFileSync(path, "utf-8");
    expect(sitemap).toContain("<loc>");
    expect(sitemap).toContain("/artifact/projects/wegopro");
    expect(sitemap).toContain("/artifacts");
  });

  it("artifact HTML contains catalog-driven title + og:image meta", () => {
    const html = readFileSync(join(DIST, "artifact/projects/wegopro/index.html"), "utf-8");
    expect(html).toContain("WegoPro - projects | Long NGUYỄN");
    expect(html).toContain('property="og:image"');
    expect(html).toContain("/og/wegopro.png");
  });

  it("home HTML contains canonical link", () => {
    const html = readFileSync(join(DIST, "index.html"), "utf-8");
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('href="https://8bu.dev/"');
  });
});
