import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { OgCard } from "./og-card";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "og");
const CACHE_DIR = join(OUT_DIR, ".cache");
const FONT_DIR = join(__dirname, "og-fonts");
const ARTIFACTS_DIR = join(ROOT, "src", "artifacts");
const ARTIFACT_KINDS = ["projects", "essays", "resume", "misc"] as const;

const WATERMARK = "Long NGUYỄN (8bu)";

interface CardSpec {
  slug: string;
  title: string;
  kicker: string;
  period: string;
  summary: string;
}

interface SatoriFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

function loadFont(name: string): Buffer {
  const path = join(FONT_DIR, name);
  if (!existsSync(path)) throw new Error(`[og:generate] missing font: ${path}`);
  return readFileSync(path);
}

function loadFonts(): SatoriFont[] {
  return [
    { name: "Inter", data: loadFont("Inter-Regular.ttf"), weight: 400, style: "normal" },
    { name: "Inter", data: loadFont("Inter-Bold.ttf"), weight: 700, style: "normal" },
    {
      name: "Source Serif 4",
      data: loadFont("SourceSerif4-Regular.ttf"),
      weight: 400,
      style: "normal",
    },
    {
      name: "Source Serif 4",
      data: loadFont("SourceSerif4-Bold.ttf"),
      weight: 700,
      style: "normal",
    },
  ];
}

function hashSpec(spec: CardSpec): string {
  const h = createHash("sha256");
  h.update(spec.title);
  h.update("\0");
  h.update(spec.kicker);
  h.update("\0");
  h.update(spec.period);
  h.update("\0");
  h.update(spec.summary);
  return h.digest("hex");
}

async function renderCard(spec: CardSpec, fonts: SatoriFont[]): Promise<Buffer> {
  const svg = await satori(
    OgCard({
      title: spec.title,
      kicker: spec.kicker,
      period: spec.period,
      summary: spec.summary,
      watermark: WATERMARK,
    }),
    { width: 1200, height: 630, fonts },
  );
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return Buffer.from(resvg.render().asPng());
}

function ensureDirs(): void {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheHit(slug: string, hash: string): boolean {
  const cachePath = join(CACHE_DIR, `${slug}.sha256`);
  const outPath = join(OUT_DIR, `${slug}.png`);
  if (!existsSync(cachePath) || !existsSync(outPath)) return false;
  return readFileSync(cachePath, "utf-8").trim() === hash;
}

function writeCache(slug: string, hash: string): void {
  writeFileSync(join(CACHE_DIR, `${slug}.sha256`), hash);
}

/**
 * Minimal YAML frontmatter parser - reads the lines between the first
 * pair of `---` fences from an MDX file and returns a string map.
 * Sufficient for the fixed frontmatter shape used by portf artifact
 * descriptors (string scalars only; lists and nested objects are not
 * required for og-card rendering).
 */
function readFrontmatter(filepath: string): Record<string, string> {
  const text = readFileSync(filepath, "utf-8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`[og:generate] no frontmatter in ${filepath}`);
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    // Strip surrounding quotes (YAML allows '...' or "...").
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[kv[1]] = value;
  }
  return fm;
}

interface DiscoveredArtifact extends CardSpec {
  kind: string;
}

function discoverArtifacts(): DiscoveredArtifact[] {
  const out: DiscoveredArtifact[] = [];
  for (const kind of ARTIFACT_KINDS) {
    const dir = join(ARTIFACTS_DIR, kind);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".mdx")) continue;
      const fm = readFrontmatter(join(dir, file));
      out.push({
        kind,
        slug: fm.slug,
        title: fm.title,
        kicker: fm.kicker ?? "open artifact",
        period: fm.period ?? "",
        summary: fm.summary ?? "",
      });
    }
  }
  return out;
}

async function main(): Promise<void> {
  ensureDirs();
  const fonts = loadFonts();
  const catalog = discoverArtifacts();

  let rendered = 0;
  let skipped = 0;

  for (const spec of catalog) {
    const hash = hashSpec(spec);
    if (cacheHit(spec.slug, hash)) {
      skipped++;
      continue;
    }
    const png = await renderCard(spec, fonts);
    writeFileSync(join(OUT_DIR, `${spec.slug}.png`), png);
    writeCache(spec.slug, hash);
    rendered++;
    console.log(`[og:generate] ${spec.slug}.png`);
  }

  const defaultSpec: CardSpec = {
    slug: "default",
    title: "Long NGUYỄN",
    kicker: "8BU.DEV",
    period: "",
    summary: "Senior Web Developer. Selected projects, essays, and a chat surface.",
  };
  const defaultHash = hashSpec(defaultSpec);
  if (!cacheHit("default", defaultHash)) {
    const png = await renderCard(defaultSpec, fonts);
    writeFileSync(join(OUT_DIR, "default.png"), png);
    writeCache("default", defaultHash);
    rendered++;
    console.log("[og:generate] default.png");
  } else {
    skipped++;
  }

  console.log(`[og:generate] done. rendered=${rendered} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
