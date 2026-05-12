import path from "node:path";
import fs from "node:fs";
import { scanMomentUsages } from "./moment-usage";

export function runReport(dir = ".") {
  const { apiCounts, totalUsages, temporalReady } = scanMomentUsages(dir);

  const report = `# moment → mmntjs Migration Report

## Current State

- moment usages: ${totalUsages}
- Temporal-ready: ${temporalReady} (${totalUsages > 0 ? Math.round((temporalReady / totalUsages) * 100) : 0}%)
- Confidence: Medium (line-level analysis; chained calls may include non-moment methods)

## Usage Breakdown

${Object.entries(apiCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([api, count]) => `- \`${api}()\`: ${count}`)
  .join("\n")}

## Checklist

- [ ] audit passed
- [ ] unit tests passing
- [ ] reviewed by team
`;

  const outPath = path.resolve(dir, "MIGRATION.md");
  fs.writeFileSync(outPath, report);
  console.log(`Report written to ${outPath}`);
}
