import fs from "fs";
import path from "path";

export function runStats(dir: string = ".") {
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
        const lines = content.split("\n");

        for (const line of lines) {
          const match = line.match(/moment\s*\.\s*(\w+)/);
          if (match) {
            const api = match[1];
            apiCounts[api] = (apiCounts[api] || 0) + 1;
            totalUsages++;
          }
        }
      }
    }
  }

  walk(path.resolve(dir));

  console.log(`\nmoment usages remaining: ${totalUsages}\n`);

  const sorted = Object.entries(apiCounts).sort((a, b) => b[1] - a[1]);
  for (const [api, count] of sorted) {
    console.log(`  ${api}(): ${count}`);
  }

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

  const pct = totalUsages > 0 ? Math.round((temporalReady / totalUsages) * 100) : 0;
  console.log(`\nTemporal-ready: ${temporalReady} (${pct}%)\n`);
}
