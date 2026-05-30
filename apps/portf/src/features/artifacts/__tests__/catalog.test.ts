import { describe, it, expect, beforeEach } from "vitest";

import type { ArtifactDescriptor } from "@/features/artifacts/types";

beforeEach(async () => {
  // Catalog is module-scoped; resetting modules guarantees a clean load
  // when tests feed it different fixture sets.
  const { vi } = await import("vitest");
  vi.resetModules();
});

describe("catalog", () => {
  it("builds a Map<slug, descriptor> from MDX modules with valid frontmatter", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");

    const modules = {
      "../../artifacts/__fixtures__/projects/sample-project.mdx": {
        default: () => null,
        frontmatter: {
          slug: "sample-project",
          kind: "projects",
          title: "Sample Project",
          period: "2024–2025",
          stack: ["TypeScript", "React"],
          summary: "Fixture",
          matchPatterns: ["sample"],
        },
      },
      "../../artifacts/__fixtures__/essays/sample-essay.mdx": {
        default: () => null,
        frontmatter: {
          slug: "sample-essay",
          kind: "essays",
          title: "A Sample Essay",
          period: "2026",
          stack: [],
          summary: "Fixture",
          matchPatterns: ["essay"],
        },
      },
    };

    const catalog = _buildCatalog(modules);

    expect(catalog.size).toBe(2);
    const sp: ArtifactDescriptor | undefined = catalog.get("sample-project");
    expect(sp?.title).toBe("Sample Project");
    expect(sp?.kind).toBe("projects");
    expect(catalog.get("sample-essay")?.kind).toBe("essays");
    // Defaults applied:
    expect(sp?.kicker).toBe("open artifact");
    expect(sp?.locale).toBe("en");
    expect(sp?.order).toBe(0);
    expect(sp?.thumb).toBe(null);
  });

  it("throws when two files declare the same slug", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");

    const modules = {
      "../../artifacts/__fixtures__/projects/sample-project.mdx": {
        default: () => null,
        frontmatter: {
          slug: "sample-project",
          kind: "projects",
          title: "A",
          period: "2024",
          stack: [],
          summary: "",
          matchPatterns: ["xx"],
        },
      },
      "../../artifacts/__fixtures__/projects/duplicate-slug.mdx": {
        default: () => null,
        frontmatter: {
          slug: "sample-project",
          kind: "projects",
          title: "B",
          period: "2025",
          stack: [],
          summary: "",
          matchPatterns: ["yy"],
        },
      },
    };

    expect(() => _buildCatalog(modules)).toThrow(/duplicate slug/i);
  });

  it("throws when frontmatter kind disagrees with directory kind", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");

    const modules = {
      "../../artifacts/__fixtures__/misc/mismatched-kind.mdx": {
        default: () => null,
        frontmatter: {
          slug: "mismatched-kind",
          kind: "projects", // directory says misc, frontmatter says projects
          title: "Mismatch",
          period: "2025",
          stack: [],
          summary: "",
          matchPatterns: ["mismatched"],
        },
      },
    };

    expect(() => _buildCatalog(modules)).toThrow(/kind mismatch/i);
  });

  it("throws when frontmatter fails valibot validation", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");

    const modules = {
      "../../artifacts/__fixtures__/projects/bad.mdx": {
        default: () => null,
        frontmatter: {
          slug: "BAD_SLUG", // uppercase + underscore: regex fails
          kind: "projects",
          title: "Bad",
          period: "2025",
          stack: [],
          summary: "",
          matchPatterns: ["xx"],
        },
      },
    };

    expect(() => _buildCatalog(modules)).toThrow();
  });

  it("excludes __fixtures__ paths from the production catalog when used via the public loader path", async () => {
    // The public loader runs `import.meta.glob('../../artifacts/**/*.mdx')`
    // and filters /__fixtures__/. The test verifies the filter is applied
    // when the helper is invoked with the production-mode flag.
    const { _buildCatalog } = await import("@/features/artifacts/catalog");

    const modules = {
      "../../artifacts/__fixtures__/projects/sample-project.mdx": {
        default: () => null,
        frontmatter: {
          slug: "sample-project",
          kind: "projects",
          title: "Sample",
          period: "2024",
          stack: [],
          summary: "",
          matchPatterns: ["xx"],
        },
      },
      "../../artifacts/projects/real.mdx": {
        default: () => null,
        frontmatter: {
          slug: "real",
          kind: "projects",
          title: "Real",
          period: "2024",
          stack: [],
          summary: "",
          matchPatterns: ["xx"],
        },
      },
    };

    const catalog = _buildCatalog(modules, { excludeFixtures: true });

    expect(catalog.size).toBe(1);
    expect(catalog.get("real")).toBeDefined();
    expect(catalog.get("sample-project")).toBeUndefined();
  });

  it("getDescriptor returns null for unknown slug", async () => {
    const { _buildCatalog, _setCatalogForTesting, getDescriptor } =
      await import("@/features/artifacts/catalog");

    const catalog = _buildCatalog({});
    _setCatalogForTesting(catalog);

    expect(getDescriptor("nonexistent")).toBeNull();
  });
});

describe("optional url field", () => {
  it("propagates url from frontmatter onto the descriptor", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");
    const mod = {
      default: () => null,
      frontmatter: {
        slug: "wegopro",
        kind: "projects",
        title: "WegoPro",
        period: "2022–2026",
        stack: ["Nuxt"],
        summary: "x",
        matchPatterns: ["xx"],
        url: "https://wegopro.com",
      },
    };
    const catalog = _buildCatalog({ "/p/artifacts/projects/wegopro.mdx": mod });
    expect(catalog.get("wegopro")?.url).toBe("https://wegopro.com");
  });

  it("descriptor.url is undefined when frontmatter omits it", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");
    const mod = {
      default: () => null,
      frontmatter: {
        slug: "essay-1",
        kind: "essays",
        title: "E",
        period: "2026",
        stack: [],
        summary: "x",
        matchPatterns: ["xx"],
      },
    };
    const catalog = _buildCatalog({ "/p/artifacts/essays/e.mdx": mod });
    expect(catalog.get("essay-1")?.url).toBeUndefined();
  });
});

describe("optional repo field", () => {
  it("propagates repo from frontmatter onto the descriptor", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");
    const mod = {
      default: () => null,
      frontmatter: {
        slug: "cosimi",
        kind: "projects",
        title: "cosimi",
        period: "2026",
        stack: ["TypeScript"],
        summary: "x",
        matchPatterns: ["xx"],
        repo: "https://github.com/8bu/x",
      },
    };
    const catalog = _buildCatalog({ "/p/artifacts/projects/cosimi.mdx": mod });
    expect(catalog.get("cosimi")?.repo).toBe("https://github.com/8bu/x");
  });

  it("descriptor.repo is undefined when frontmatter omits it", async () => {
    const { _buildCatalog } = await import("@/features/artifacts/catalog");
    const mod = {
      default: () => null,
      frontmatter: {
        slug: "essay-2",
        kind: "essays",
        title: "E",
        period: "2026",
        stack: [],
        summary: "x",
        matchPatterns: ["xx"],
      },
    };
    const catalog = _buildCatalog({ "/p/artifacts/essays/e2.mdx": mod });
    expect(catalog.get("essay-2")?.repo).toBeUndefined();
  });
});

describe("FrontmatterSchema.repo", () => {
  it("accepts optional repo URL", async () => {
    const v = await import("valibot");
    const { FrontmatterSchema } = await import("@/features/artifacts/types");
    const parsed = v.parse(FrontmatterSchema, {
      slug: "test",
      kind: "projects",
      title: "T",
      period: "2025",
      stack: [],
      summary: "s",
      matchPatterns: ["test"],
      repo: "https://github.com/8bu/test",
    });
    expect(parsed.repo).toBe("https://github.com/8bu/test");
  });

  it("omitting repo leaves it undefined", async () => {
    const v = await import("valibot");
    const { FrontmatterSchema } = await import("@/features/artifacts/types");
    const parsed = v.parse(FrontmatterSchema, {
      slug: "test",
      kind: "projects",
      title: "T",
      period: "2025",
      stack: [],
      summary: "s",
      matchPatterns: ["test"],
    });
    expect(parsed.repo).toBeUndefined();
  });
});
