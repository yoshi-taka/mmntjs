// @ts-nocheck
const gc = globalThis.Bun?.gc ?? globalThis.gc;

async function measure(label, importPath) {
  gc(true); gc(true);
  const before = process.memoryUsage();
  await import(importPath);
  gc(true); gc(true);
  await new Promise(r => setTimeout(r, 50));
  gc(true);
  const after = process.memoryUsage();
  return {
    heap: after.heapUsed - before.heapUsed,
    rss: after.rss - before.rss,
    external: after.external - before.external,
  };
}

const f1 = await measure("moment", "../moment/moment.js");
const f2 = await measure("moment2", "../moment");

console.log("Module footprint:\n");
console.log("┌─────────────────────┬──────────┬──────────┬────────┐");
console.log("│ Metric              │ moment   │ moment2  │ %      │");
console.log("├─────────────────────┼──────────┼──────────┼────────┤");

for (const [label, key] of [["heapUsed", "heap"], ["rss", "rss"], ["external", "external"]]) {
  const v1 = ((f1[key]) / 1024).toFixed(0).padStart(6) + "KB";
  const v2 = ((f2[key]) / 1024).toFixed(0).padStart(6) + "KB";
  const pct = (f2[key] / f1[key] * 100).toFixed(0).padStart(5) + "%";
  console.log(`│ ${label.padEnd(19)} │ ${v1} │ ${v2} │ ${pct} │`);
}
console.log("└─────────────────────┴──────────┴──────────┴────────┘");
