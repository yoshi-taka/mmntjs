import { scanMomentUsages } from "./moment-usage";

export function runStats(dir = ".") {
  const { apiCounts, totalUsages, temporalReady } = scanMomentUsages(dir);

  console.log(`\nmoment usages found: ${totalUsages}\n`);

  const sorted = Object.entries(apiCounts).sort((a, b) => b[1] - a[1]);
  for (const [api, count] of sorted) {
    console.log(`  ${api}(): ${count}`);
  }

  const pct = totalUsages > 0 ? Math.round((temporalReady / totalUsages) * 100) : 0;
  console.log(`\nTemporal-ready: ${temporalReady} / ${totalUsages} (${pct}%)\n`);
}
