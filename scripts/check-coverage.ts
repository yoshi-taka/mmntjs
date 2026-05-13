import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const THRESHOLD = parseFloat(process.argv[2] || "80");
const LCOV_PATH = resolve(import.meta.dirname, "..", "coverage", "lcov.info");

interface FileCoverage {
  file: string;
  hit: number;
  found: number;
}

function parseLcov(text: string): FileCoverage[] {
  const records: FileCoverage[] = [];
  const blocks = text.split("end_of_record").filter((b) => b.trim());

  for (const block of blocks) {
    const fileMatch = block.match(/^SF:(.+)$/m);
    if (!fileMatch) continue;
    const file = fileMatch[1];

    const das = block.match(/^DA:(\d+),(\d+)$/gm);
    if (!das) continue;

    let hit = 0;
    let found = 0;
    for (const da of das) {
      const [, , count] = da.match(/^DA:(\d+),(\d+)$/)!;
      found++;
      if (parseInt(count) > 0) hit++;
    }

    records.push({ file, hit, found });
  }

  return records;
}

const lcovText = readFileSync(LCOV_PATH, "utf-8");
const allRecords = parseLcov(lcovText);

const srcRecords = allRecords.filter((r) => r.file.startsWith("src/"));

let totalHit = 0;
let totalFound = 0;
const fileResults: { file: string; pct: number; hit: number; found: number }[] = [];

for (const r of srcRecords) {
  totalHit += r.hit;
  totalFound += r.found;
  fileResults.push({
    file: r.file,
    pct: r.found > 0 ? (r.hit / r.found) * 100 : 0,
    hit: r.hit,
    found: r.found,
  });
}

const totalPct = totalFound > 0 ? (totalHit / totalFound) * 100 : 0;

fileResults.sort((a, b) => a.pct - b.pct);

console.log("\n=== Coverage Report (src/) ===\n");
console.log(`${"File".padEnd(50)} ${"Coverage".padEnd(10)} ${"Hit/Found"}`);
console.log("-".repeat(75));
for (const r of fileResults) {
  const marker = r.pct < THRESHOLD ? " ⚠" : "";
  console.log(`${r.file.padEnd(50)} ${r.pct.toFixed(1).padStart(5)}%${marker}   ${r.hit}/${r.found}`);
}
console.log("-".repeat(75));
console.log(`${"TOTAL".padEnd(50)} ${totalPct.toFixed(1).padStart(5)}%   ${totalHit}/${totalFound}`);

const passed = totalPct >= THRESHOLD;

const lowest = fileResults.filter((r) => r.found >= 10).slice(0, 5);
console.log(`\nLowest coverage files (≥10 lines):`);
for (const r of lowest) {
  console.log(`  ${r.file}: ${r.pct.toFixed(1)}% (${r.hit}/${r.found})`);
}

if (passed) {
  console.log(`\n✅ Coverage ${totalPct.toFixed(1)}% >= ${THRESHOLD}% — PASSED`);
} else {
  console.log(`\n❌ Coverage ${totalPct.toFixed(1)}% < ${THRESHOLD}% — FAILED`);
  process.exit(1);
}
