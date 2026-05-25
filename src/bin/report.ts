import { scanMomentUsages } from "./moment-usage";
import { scanFiles } from "./codemod";
import type { OutputFormat } from "./audit";

function buildTextReport(
  apiCounts: Record<string, number>,
  totalUsages: number,
  temporalReady: number,
  modifiedFiles: number,
): string {
  const pct = totalUsages > 0 ? Math.round((temporalReady / totalUsages) * 100) : 0;
  return [
    `moment usages: ${totalUsages}`,
    `Temporal-ready: ${temporalReady} (${pct}%)`,
    `Files scanned: ${modifiedFiles}`,
    `Usage breakdown:`,
    ...Object.entries(apiCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([api, count]) => `  ${api}: ${count}`),
  ].join("\n");
}

function buildMarkdownReport(
  apiCounts: Record<string, number>,
  totalUsages: number,
  temporalReady: number,
  results: {
    modifiedFiles: string[];
    fullOnly: Record<string, Record<string, number>>;
    liteOk: Record<string, Record<string, number>>;
    fnsOk: Record<string, Record<string, number>>;
    tzFiles: string[];
  },
  dir: string,
): string {
  const fullFiles = Object.keys(results.fullOnly);
  const liteOnlyFiles = results.modifiedFiles.filter((f) => {
    const fo = results.fullOnly[f] ?? {};
    return Object.keys(fo).length === 0;
  });
  const fnsOnlyFiles = results.modifiedFiles.filter((f) => {
    const fo = results.fullOnly[f] ?? {};
    const lo = results.liteOk[f] ?? {};
    return Object.keys(fo).length === 0 && Object.keys(lo).length === 0;
  });

  function fileList(files: string[], baseDir: string): string {
    return files.map((f) => `  - \`${f.replace(baseDir, "").replace(/^\//, "")}\``).join("\n");
  }

  const entryRecommendation =
    fullFiles.length === 0
      ? fnsOnlyFiles.length === results.modifiedFiles.length
        ? "`mmntjs/fns` (~0.5-1.3KB gzip bundled)"
        : "`mmntjs/lite` (~14.8KB gzip bundled)"
      : "`mmntjs` (~45.1KB gzip bundled, mixed with lite-compatible files)";

  return `# moment → mmntjs Migration Report

## Current State

- moment usages: ${totalUsages}
- Temporal-ready: ${temporalReady} (${totalUsages > 0 ? Math.round((temporalReady / totalUsages) * 100) : 0}%)
- Confidence: Medium (line-level analysis; chained calls may include non-moment methods)
- Files scanned: ${results.modifiedFiles.length}

## Entry Point Recommendation

Recommended: ${entryRecommendation}

### Files needing full (\`mmntjs\`, ~45.1KB gzip bundled)
${fullFiles.length > 0 ? fileList(fullFiles, dir) : "  (none)"}

### Files compatible with lite (\`mmntjs/lite\`, ~14.8KB gzip bundled)
${liteOnlyFiles.length > 0 ? fileList(liteOnlyFiles, dir) : "  (none)"}

### Files compatible with fns (\`mmntjs/fns\`, ~0.5-1.3KB gzip bundled)
${fnsOnlyFiles.length > 0 ? fileList(fnsOnlyFiles, dir) : "  (none)"}

${
  results.tzFiles.length > 0
    ? `### Timezone files
${results.tzFiles.map((f) => `  - \`${f.replace(dir, "").replace(/^\//, "")}\``).join("\n")}
→ Will add \`import "mmntjs-timezone"\` side-effect import.
`
    : ""
}

## Usage Breakdown

${Object.entries(apiCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([api, count]) => `- \`${api}()\`: ${count}`)
  .join("\n")}

## Checklist

- [ ] audit passed
- [ ] entry point selected (see recommendation above)
- [ ] unit tests passing
- [ ] reviewed by team
`;
}

export function runReport(format: OutputFormat, dir = ".") {
  const { apiCounts, totalUsages, temporalReady } = scanMomentUsages(dir);

  const results = scanFiles(dir) as unknown as {
    modifiedFiles: string[];
    fullOnly: Record<string, Record<string, number>>;
    liteOk: Record<string, Record<string, number>>;
    fnsOk: Record<string, Record<string, number>>;
    tzFiles: string[];
  };

  if (format === "markdown") {
    const report = buildMarkdownReport(apiCounts, totalUsages, temporalReady, results, dir);
    console.log(report);
  } else {
    const report = buildTextReport(
      apiCounts,
      totalUsages,
      temporalReady,
      results.modifiedFiles.length,
    );
    console.log(report);
  }
}
