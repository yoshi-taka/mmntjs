const gc = globalThis.gc as (() => void) | undefined;

async function measure(label: string, importPath: string) {
  gc?.(); gc?.();
  const before = process.memoryUsage();
  await import(importPath);
  gc?.(); gc?.();
  await new Promise(r => setTimeout(r, 50));
  gc?.();
  const after = process.memoryUsage();
  return {
    heap: after.heapUsed - before.heapUsed,
    rss: after.rss - before.rss,
    external: after.external - before.external,
  };
}

const f1 = await measure("moment", "../moment/moment.js");
const f2 = await measure("mmntjs", "../moment");

console.log("Module footprint:\n");
console.log("┌─────────────────────┬──────────┬──────────┬────────┐");
console.log("│ Metric              │ moment   │ mmntjs  │ %      │");
console.log("├─────────────────────┼──────────┼──────────┼────────┤");

for (const [label, key] of [["heapUsed", "heap"], ["rss", "rss"], ["external", "external"]]) {
  const f1r = f1 as Record<string, number>;
  const f2r = f2 as Record<string, number>;
  const v1 = `${((f1r[key]) / 1024).toFixed(0).padStart(6)  }KB`;
  const v2 = `${((f2r[key]) / 1024).toFixed(0).padStart(6)  }KB`;
  const pct = `${(f2r[key] / f1r[key] * 100).toFixed(0).padStart(5)  }%`;
  console.log(`│ ${label.padEnd(19)} │ ${v1} │ ${v2} │ ${pct} │`);
}
console.log("└─────────────────────┴──────────┴──────────┴────────┘");
export {};
