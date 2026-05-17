#!/usr/bin/env bun
/**
 * fuzz-corpus-replay.ts — Replay corpus against the current build.
 *
 * For each corpus file, applies the appropriate fuzz harness
 * and reports success/failure.
 *
 * Run: bun run scripts/fuzz-corpus-replay.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const CORPUS = resolve(ROOT, "test", "fuzz", "corpus");

// Map corpus dir → fuzz harness
const HARNESS_MAP: Record<string, string> = {
  parse: "test/fuzz/parse.fuzz.js",
  grammar: "test/fuzz/grammar.fuzz.js",
  "parse-zone": "test/fuzz/parse.fuzz.js",
  duration: "test/fuzz/duration.fuzz.js",
  format: "test/fuzz/format.fuzz.js",
  strict: "test/fuzz/parse.fuzz.js",
  locale: "test/fuzz/parse.fuzz.js",
  arrays: "test/fuzz/array-input.fuzz.js",
  objects: "test/fuzz/object-input.fuzz.js",
  utc: "test/fuzz/utc.fuzz.js",
  reltime: "test/fuzz/reltime.fuzz.js",
  diff: "test/fuzz/diff-datefns.fuzz.js",
  operations: "test/fuzz/operations.fuzz.js",
};

interface Result {
  dir: string;
  file: string;
  harness: string;
  pass: boolean;
  error?: string;
}

function main(): void {
  const results: Result[] = [];
  let passed = 0;
  let failed = 0;

  const dirs = readdirSync(CORPUS).filter((d) => {
    const p = resolve(CORPUS, d);
    return statSync(p).isDirectory();
  });

  for (const dir of dirs) {
    const harness = HARNESS_MAP[dir];
    if (!harness) {
      console.log(`[SKIP] ${dir}/ — no harness mapping`);
      continue;
    }

    const dirPath = resolve(CORPUS, dir);
    const files = readdirSync(dirPath).filter((f) => {
      const p = resolve(dirPath, f);
      return statSync(p).isFile() && statSync(p).size > 0;
    });

    if (files.length === 0) continue;

    // Use Jazzer's built-in corpus replay via -runs=0 (just replay, don't fuzz)
    // This is more efficient than running each file individually
    const harnessPath = resolve(ROOT, harness);

    // Build the dist first
    if (passed === 0 && failed === 0) {
      console.log("Building dist/ for fuzz harnesses...");
      const build = spawnSync("bun", ["run", "build"], { cwd: ROOT, stdio: "pipe" });
      if (build.status !== 0) {
        console.error("Build failed. Aborting.");
        process.exit(1);
      }
    }

    // Replay with Jazzer's corpus mode
    console.log(`\n[REPLAY] ${dir}/ (${files.length} files) → ${harness}`);
    const jazzer = spawnSync(
      "bun",
      [
        "x", "jazzer", harnessPath,
        "--sync", "-i", "dist/",
        "--", "-runs=0", `-max_len=64`,
        `${dirPath}/`,
      ],
      { cwd: ROOT, stdio: "pipe", timeout: 30000 },
    );

    const stdout = jazzer.stdout?.toString() || "";
    const stderr = jazzer.stderr?.toString() || "";

    if (jazzer.status === 0) {
      console.log(`  ✅ PASS (${files.length} files)`);
      passed++;
    } else {
      // Jazzer returns non-zero on finding a crash
      const crashMatch = stdout.match(/ERROR:\s*(.*)/) || stderr.match(/ERROR:\s*(.*)/);
      console.log(`  ❌ FAIL - ${crashMatch?.[1] || "unknown error"}`);
      failed++;
      console.log(`  stdout: ${stdout.slice(0, 200)}`);
      console.log(`  stderr: ${stderr.slice(0, 200)}`);
    }

    results.push({
      dir,
      file: `${files.length} files`,
      harness,
      pass: jazzer.status === 0,
      error: jazzer.status !== 0 ? (jazzer.stderr?.toString() || "unknown").slice(0, 200) : undefined,
    });
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Corpus Replay Summary");
  console.log("=".repeat(50));
  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    console.log(`${icon} ${r.dir.padEnd(16)} ${r.file.padEnd(20)} ${r.error ? r.error.slice(0, 60) : ""}`);
  }
  console.log("-".repeat(50));
  console.log(`Total: ${results.length} directories, ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

main();
