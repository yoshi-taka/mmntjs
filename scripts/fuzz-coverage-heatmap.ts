#!/usr/bin/env bun
/**
 * fuzz-coverage-heatmap.ts — Generate coverage heatmap JSON report.
 *
 * Parses LCOV output from `bun test --coverage` and produces:
 *   - Per-file line/branch coverage percentages
 *   - Subsystem-level aggregation (src/parse.ts, src/moment-class.ts, etc.)
 *   - Coldest files (lowest coverage)
 *   - Heatmap data for visualization
 *   - Historical snapshot for delta tracking
 *
 * Run: bun run test:coverage && bun run scripts/fuzz-coverage-heatmap.ts
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LCOV_PATH = resolve(ROOT, "coverage", "lcov.info");
const OUTPUT_DIR = resolve(ROOT, "test", "fuzz", "coverage");

interface FileCoverage {
  file: string;
  subsystem: string;
  lines: { line: number; hit: number }[];
  hit: number;
  total: number;
  pct: number;
}

function parseLcov(text: string): FileCoverage[] {
  const records: FileCoverage[] = [];
  const blocks = text.split("end_of_record").filter((b) => b.trim());

  for (const block of blocks) {
    const fileMatch = block.match(/^SF:(.+)$/m);
    if (!fileMatch) continue;
    const file = fileMatch[1];

    const lineMatches = block.match(/^DA:(\d+),(\d+)$/gm);
    if (!lineMatches) continue;

    const lines: { line: number; hit: number }[] = [];
    let hit = 0;
    let total = 0;

    for (const da of lineMatches) {
      const [, lineStr, countStr] = da.match(/^DA:(\d+),(\d+)$/)!;
      const lineNum = parseInt(lineStr);
      const count = parseInt(countStr);
      lines.push({ line: lineNum, hit: count });
      total++;
      if (count > 0) hit++;
    }

    const pct = total > 0 ? (hit / total) * 100 : 0;
    const subsystems = ["src/parse", "src/parse-format", "src/moment-class", "src/units", "src/format", "src/duration", "src/locale", "src/utc", "src/display", "src/reltime"];
    const subsystem = subsystems.find((s) => file.startsWith(s)) || "other";

    records.push({ file, subsystem, lines, hit, total, pct });
  }

  return records;
}

function aggregateBySubsystem(records: FileCoverage[]): Record<string, { hit: number; total: number; pct: number; files: string[] }> {
  const map = new Map<string, { hit: number; total: number; files: string[] }>();
  for (const r of records) {
    if (!map.has(r.subsystem)) map.set(r.subsystem, { hit: 0, total: 0, files: [] });
    const s = map.get(r.subsystem)!;
    s.hit += r.hit;
    s.total += r.total;
    s.files.push(r.file);
  }
  const result: Record<string, { hit: number; total: number; pct: number; files: string[] }> = {};
  for (const [key, val] of map) {
    result[key] = { ...val, pct: val.total > 0 ? (val.hit / val.total) * 100 : 0 };
  }
  return result;
}

function findColdspots(records: FileCoverage[], minLines: number = 10): FileCoverage[] {
  return records
    .filter((r) => r.total >= minLines)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 20);
}

function loadPreviousSnapshot(): Record<string, number> | null {
  const snapshotPath = resolve(OUTPUT_DIR, "previous-snapshot.json");
  if (!existsSync(snapshotPath)) return null;
  try {
    const data = JSON.parse(readFileSync(snapshotPath, "utf-8"));
    return data.fileCoverage as Record<string, number>;
  } catch {
    return null;
  }
}

function main(): void {
  if (!existsSync(LCOV_PATH)) {
    console.error(`Coverage data not found at ${LCOV_PATH}`);
    console.error("Run 'bun run test:coverage' first.");
    process.exit(1);
  }

  const lcovText = readFileSync(LCOV_PATH, "utf-8");
  const allRecords = parseLcov(lcovText);

  // Filter to src/ files only (our code, not moment.js or node_modules)
  const srcRecords = allRecords.filter((r) => r.file.startsWith("src/"));
  const previousSnapshot = loadPreviousSnapshot();

  // Subsystem aggregation
  const subsystems = aggregateBySubsystem(srcRecords);
  const coldspots = findColdspots(srcRecords);

  // Per-file coverage map
  const fileCoverage: Record<string, number> = {};
  for (const r of srcRecords) {
    fileCoverage[r.file] = r.pct;
  }

  // Delta tracking
  const deltas: Record<string, number> = {};
  if (previousSnapshot) {
    for (const [file, pct] of Object.entries(fileCoverage)) {
      const prev = previousSnapshot[file];
      if (prev !== undefined) {
        deltas[file] = Math.round((pct - prev) * 10) / 10;
      }
    }
  }

  // Compute hottest and coldest 10 lines across all files
  const allLines = srcRecords.flatMap((r) =>
    r.lines.map((l) => ({
      file: r.file,
      line: l.line,
      hit: l.hit,
      covered: l.hit > 0,
    })),
  );
  allLines.sort((a, b) => a.hit - b.hit);
  const coldestLines = allLines.slice(0, 10);
  const hottestLines = allLines.filter((l) => l.hit > 0).sort((a, b) => b.hit - a.hit).slice(0, 10);

  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: srcRecords.length,
    totalLines: srcRecords.reduce((a, r) => a + r.total, 0),
    totalHit: srcRecords.reduce((a, r) => a + r.hit, 0),
    overallCoverage: srcRecords.reduce((a, r) => a + r.total, 0) > 0
      ? Math.round((srcRecords.reduce((a, r) => a + r.hit, 0) / srcRecords.reduce((a, r) => a + r.total, 0)) * 1000) / 10
      : 0,
    subsystems,
    coldspots: coldspots.map((r) => ({
      file: r.file,
      pct: Math.round(r.pct * 10) / 10,
      hit: r.hit,
      total: r.total,
    })),
    coldestLines: coldestLines.map((l) => `${l.file}:${l.line} (hit=${l.hit})`),
    hottestLines: hottestLines.map((l) => `${l.file}:${l.line} (hit=${l.hit})`),
    deltas: Object.keys(deltas).length > 0 ? deltas : undefined,
    fileCoverage,
  };

  // Write report
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const reportPath = resolve(OUTPUT_DIR, "heatmap.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Coverage heatmap written to ${reportPath}`);

  // Save snapshot for next delta comparison
  writeFileSync(resolve(OUTPUT_DIR, "previous-snapshot.json"), JSON.stringify({ fileCoverage, timestamp: report.timestamp }, null, 2));

  // Print summary
  console.log(`\n=== Coverage Heatmap Summary ===`);
  console.log(`Overall: ${report.overallCoverage}% (${report.totalHit}/${report.totalLines} lines)`);
  console.log(`Source files: ${report.totalFiles}`);
  console.log(`\nSubsystem Coverage:`);
  for (const [name, stat] of Object.entries(subsystems).sort(([, a], [, b]) => a.pct - b.pct)) {
    const icon = stat.pct >= 80 ? "🟢" : stat.pct >= 50 ? "🟡" : "🔴";
    console.log(`  ${icon} ${name.padEnd(20)} ${stat.pct.toFixed(1).padStart(5)}% (${stat.hit}/${stat.total})`);
  }

  console.log(`\nColdest Files (≥10 lines):`);
  for (const c of coldspots) {
    const icon = c.pct >= 80 ? "🟢" : c.pct >= 50 ? "🟡" : "🔴";
    const delta = deltas[c.file];
    const deltaStr = delta !== undefined ? ` (Δ ${delta >= 0 ? "+" : ""}${delta}%)` : "";
    console.log(`  ${icon} ${c.file.padEnd(50)} ${c.pct.toFixed(1).padStart(5)}%${deltaStr}`);
  }

  if (Object.keys(deltas).length > 0) {
    const improved = Object.entries(deltas).filter(([, d]) => d > 0).length;
    const regressed = Object.entries(deltas).filter(([, d]) => d < 0).length;
    console.log(`\nCoverage changes: ${improved} improved, ${regressed} regressed`);
  }
}

main();
