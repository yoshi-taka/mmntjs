#!/usr/bin/env bun
/**
 * fuzz-corpus-minimize.ts — Deduplicate and minimize fuzz corpus.
 *
 * - Removes byte-identical duplicates
 * - Reports file sizes for manual review
 * - Optionally removes files that don't trigger new coverage
 *   (Jazzer/libFuzzer handles this internally with -merge=1)
 *
 * Run: bun run scripts/fuzz-corpus-minimize.ts
 */

import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");
const CORPUS = resolve(ROOT, "test", "fuzz", "corpus");

interface CorpusStat {
  dir: string;
  file: string;
  path: string;
  size: number;
  hash: string;
}

function* walkDir(dir: string): Generator<string> {
  try {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (statSync(full).isFile()) {
        yield full;
      }
    }
  } catch {}
}

function main(): void {
  const allFiles: CorpusStat[] = [];

  // Collect all files
  const corpDirs = readdirSync(CORPUS).filter((d) => {
    const p = resolve(CORPUS, d);
    return statSync(p).isDirectory();
  });

  for (const dir of corpDirs) {
    const dirPath = resolve(CORPUS, dir);
    for (const filePath of walkDir(dirPath)) {
      const stat = statSync(filePath);
      const content = readFileSync(filePath);
      const hash = createHash("sha256").update(content).digest("hex");
      allFiles.push({
        dir,
        file: filePath.split("/").pop()!,
        path: filePath,
        size: stat.size,
        hash,
      });
    }
  }

  // Deduplicate by hash (within same directory, keep smallest)
  const byDirAndHash = new Map<string, CorpusStat[]>();
  for (const f of allFiles) {
    const key = `${f.dir}::${f.hash}`;
    if (!byDirAndHash.has(key)) byDirAndHash.set(key, []);
    byDirAndHash.get(key)!.push(f);
  }

  let removed = 0;
  let totalBefore = allFiles.length;
  let totalBytesBefore = allFiles.reduce((a, b) => a + b.size, 0);

  for (const [key, files] of byDirAndHash) {
    if (files.length <= 1) continue;
    // Sort by size (keep smallest)
    files.sort((a, b) => a.size - b.size);
    // Keep first (smallest), remove rest
    for (let i = 1; i < files.length; i++) {
      unlinkSync(files[i].path);
      removed++;
    }
  }

  // Report stats by directory
  const byDir = new Map<string, { files: number; bytes: number }>();
  for (const f of allFiles) {
    if (!byDir.has(f.dir)) byDir.set(f.dir, { files: 0, bytes: 0 });
    const s = byDir.get(f.dir)!;
    // Only count files that still exist
    if (existsSync(f.path)) {
      s.files++;
      s.bytes += f.size;
    }
  }

  console.log("=== Corpus Statistics ===");
  console.log(`${"Directory".padEnd(16)} ${"Files".padEnd(8)} ${"Size".padEnd(10)}`);
  console.log("-".repeat(36));
  let totalFiles = 0;
  let totalBytes = 0;
  for (const [dir, stat] of [...byDir.entries()].sort()) {
    console.log(`${(dir + "/").padEnd(16)} ${String(stat.files).padEnd(8)} ${formatBytes(stat.bytes).padEnd(10)}`);
    totalFiles += stat.files;
    totalBytes += stat.bytes;
  }
  console.log("-".repeat(36));
  console.log(`${"TOTAL".padEnd(16)} ${String(totalFiles).padEnd(8)} ${formatBytes(totalBytes).padEnd(10)}`);
  if (removed > 0) {
    console.log(`\nRemoved ${removed} duplicate(s). Before: ${totalBefore} files, ${formatBytes(totalBytesBefore)}. After: ${totalFiles} files, ${formatBytes(totalBytes)}.`);
  } else {
    console.log("\nNo duplicates found.");
  }

  // Write summary
  const summary = {
    timestamp: new Date().toISOString(),
    directories: Object.fromEntries(byDir),
    totalFiles,
    totalBytes,
    duplicatesRemoved: removed,
  };
  const metaPath = resolve(CORPUS, "..", "corpus-summary.json");
  writeFileSync(metaPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary written to ${metaPath}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

main();
