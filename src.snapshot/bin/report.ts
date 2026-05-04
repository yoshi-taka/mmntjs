import fs from "fs";
import path from "path";

export function runReport(dir: string = ".") {
  const apiCounts: Record<string, number> = {};
  let totalUsages = 0;

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(js|ts|jsx|tsx|vue)$/.test(entry.name)) {
        const content = fs.readFileSync(p, "utf-8");
        for (const line of content.split("\n")) {
          const match = line.match(/moment\s*\.\s*(\w+)/);
          if (match) {
            apiCounts[match[1]] = (apiCounts[match[1]] || 0) + 1;
            totalUsages++;
          }
        }
      }
    }
  }

  walk(path.resolve(dir));

  const temporalReady = Object.entries(apiCounts)
    .filter(([api]) =>
      [
        "format",
        "add",
        "subtract",
        "diff",
        "clone",
        "isBefore",
        "isAfter",
        "isSame",
        "year",
        "month",
        "date",
        "hour",
        "minute",
        "second",
        "valueOf",
        "unix",
        "toISOString",
        "toJSON",
        "daysInMonth",
        "isLeapYear",
        "isValid",
      ].includes(api),
    )
    .reduce((sum, [, count]) => sum + count, 0);

  const report = `# moment → @compat/moment2 Migration Report

## Current State

- moment usages: ${totalUsages}
- Temporal-ready: ${temporalReady} (${totalUsages > 0 ? Math.round((temporalReady / totalUsages) * 100) : 0}%)
- Confidence: High

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
