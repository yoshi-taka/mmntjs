import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type Mapping = {
  route: string;
  siteFiles: string[];
  sourceDocs: string[];
};

const projectRoot = join(import.meta.dir, "..");
const STALE_TOLERANCE_MS = 60_000;

const ignoredSourcePatterns = [
  "docs/analysis/*",
  "docs/arch/*",
];

const mappings: Mapping[] = [
  {
    route: "/",
    siteFiles: ["site/src/pages/index.astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md", "docs/site/WEBSITE_IA.md"],
  },
  {
    route: "/docs/",
    siteFiles: ["site/src/pages/docs/index.astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/site/WEBSITE_IA.md"],
  },
  {
    route: "/compatibility/",
    siteFiles: ["site/src/pages/compatibility/index.astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/meta/REMAINING.md", "docs/testing/QUALITY_UP.md"],
  },
  {
    route: "/quality/",
    siteFiles: ["site/src/pages/quality/index.astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/testing/QUALITY_UP.md", "docs/testing/STRATEGY.md", "docs/testing/STRATEGY.ja.md"],
  },
  {
    route: "/performance/",
    siteFiles: ["site/src/pages/performance/index.astro", "site/src/content/site.ts"],
    sourceDocs: [
      "README.md",
      "docs/arch/bundlesize-timezone.md",
      "docs/perf/ANALYSIS.md",
      "docs/perf/ANALYSIS.ja.md",
      "docs/perf/BENCHMARKS.md",
      "docs/perf/BENCHMARKS.ja.md",
      "docs/perf/TECHNIQUES.md",
      "docs/perf/TECHNIQUES.ja.md",
    ],
  },
  {
    route: "/migration/",
    siteFiles: ["site/src/pages/migration/index.astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md", "docs/site/WEBSITE_IA.md", "docs/meta/REMAINING.md"],
  },
  {
    route: "/faq/",
    siteFiles: ["site/src/pages/faq/index.astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md", "docs/site/WEBSITE_IA.md"],
  },
  {
    route: "/changelog/",
    siteFiles: ["site/src/pages/changelog/index.astro", "site/src/content/site.ts"],
    sourceDocs: ["docs/meta/history.md", "docs/testing/QUALITY_UP.md"],
  },
  {
    route: "/docs/getting-started/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/site/WEBSITE_IA.md"],
  },
  {
    route: "/docs/installation/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md"],
  },
  {
    route: "/docs/basic-usage/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md"],
  },
  {
    route: "/docs/parsing/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/meta/REMAINING.md", "docs/testing/QUALITY_UP.md"],
  },
  {
    route: "/docs/formatting/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md"],
  },
  {
    route: "/docs/manipulation/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md"],
  },
  {
    route: "/docs/query-comparison/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md"],
  },
  {
    route: "/docs/duration/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md"],
  },
  {
    route: "/docs/locale/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md"],
  },
  {
    route: "/docs/timezone-parsezone/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/testing/QUALITY_UP.md"],
  },
  {
    route: "/docs/invalid-dates/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/testing/QUALITY_UP.md", "docs/meta/REMAINING.md"],
  },
  {
    route: "/docs/typescript/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md"],
  },
  {
    route: "/docs/browser-usage/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts", "site/src/pages/performance/index.astro"],
    sourceDocs: ["README.md", "docs/arch/bundlesize-timezone.md"],
  },
  {
    route: "/docs/runtime-support/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md"],
  },
  {
    route: "/docs/migration-notes/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md", "docs/meta/REMAINING.md"],
  },
  {
    route: "/docs/known-differences/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "docs/meta/REMAINING.md", "docs/testing/QUALITY_UP.md"],
  },
  {
    route: "/docs/api-reference/",
    siteFiles: ["site/src/pages/docs/[slug].astro", "site/src/content/site.ts"],
    sourceDocs: ["README.md", "spec.md"],
  },
];

function walkMarkdownFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relative(projectRoot, fullPath).replaceAll("\\", "/"));
    }
  }

  return files;
}

function matchesPattern(filePath: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return filePath === pattern;
  }

  const [prefix, suffix] = pattern.split("*");
  return filePath.startsWith(prefix) && filePath.endsWith(suffix || "");
}

function isIgnored(filePath: string): boolean {
  return ignoredSourcePatterns.some((pattern) => matchesPattern(filePath, pattern));
}

function getMtimeMs(relPath: string): number {
  return statSync(join(projectRoot, relPath)).mtimeMs;
}

function formatAge(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

const allSourceDocs = uniq([
  "README.md",
  "spec.md",
  ...walkMarkdownFiles(join(projectRoot, "docs")),
]).sort((a, b) => a.localeCompare(b));

const mappedSources = new Set(mappings.flatMap((mapping) => mapping.sourceDocs));
const unmappedSources = allSourceDocs.filter((filePath) => !mappedSources.has(filePath) && !isIgnored(filePath));

const staleMappings = mappings
  .map((mapping) => {
    const newestSource = Math.max(...mapping.sourceDocs.map(getMtimeMs));
    const newestSiteFile = Math.max(...mapping.siteFiles.map(getMtimeMs));

    return {
      ...mapping,
      newestSource,
      newestSiteFile,
    };
  })
  .filter((mapping) => mapping.newestSource - mapping.newestSiteFile > STALE_TOLERANCE_MS)
  .sort((a, b) => b.newestSource - a.newestSource);

console.log("\n=== Site Doc Drift Check ===\n");
console.log(`Mapped routes: ${mappings.length}`);
console.log(`Source markdown files considered: ${allSourceDocs.filter((filePath) => !isIgnored(filePath)).length}`);
console.log(`Ignored markdown files: ${allSourceDocs.filter(isIgnored).length}`);

if (unmappedSources.length > 0) {
  console.log("\nUnmapped source markdown files:");
  for (const filePath of unmappedSources) {
    console.log(`  - ${filePath}`);
  }
}

if (staleMappings.length > 0) {
  console.log("\nSite routes older than their mapped markdown sources:");
  for (const mapping of staleMappings) {
    console.log(`  - ${mapping.route}`);
    console.log(`    source newest: ${formatAge(mapping.newestSource)}`);
    console.log(`    site newest:   ${formatAge(mapping.newestSiteFile)}`);
    console.log(`    sources: ${mapping.sourceDocs.join(", ")}`);
  }
}

if (unmappedSources.length === 0 && staleMappings.length === 0) {
  console.log("\nOK: no unmapped markdown files and no obvious stale site routes.");
} else {
  console.log("\nFAIL: site summary pages may be missing markdown updates.");
  process.exit(1);
}
