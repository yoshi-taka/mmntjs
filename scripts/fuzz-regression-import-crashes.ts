#!/usr/bin/env bun
/**
 * fuzz-regression-import-crashes.ts — Import existing crash files and
 * fixed bug test cases into the regression corpus.
 *
 * Sources:
 *   1. test/fuzz/crashes/ — preserved libFuzzer crash files
 *   2. test/regression/crashes.test.ts — FIXED_PARSE, FIXED_UTC lists
 *   3. Known past bugs from handover memo
 *
 * Run: bun run scripts/fuzz-regression-import-crashes.ts
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const CRASHES_DIR = resolve(ROOT, "test", "fuzz", "crashes");
const REGRESSION = resolve(ROOT, "test", "fuzz", "regression");

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function writeEntry(category: string, name: string, input: string, meta: Record<string, unknown>): void {
  const dir = resolve(REGRESSION, category, name);
  if (existsSync(dir)) {
    console.log(`  [SKIP] ${category}/${name} — already exists`);
    return;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "input"), input, "utf-8");
  writeFileSync(resolve(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf-8");
  console.log(`  [ADD]  ${category}/${name}`);
}

function determineCategory(
  input: string,
): "parse" | "utc" | "grammar" | "parse-zone" | "operations" {
  // Heuristic: detect parseZone patterns
  if (input.includes("+") && /[+-]\d{2}:\d{2}/.test(input)) {
    return "parse-zone";
  }
  // UTC patterns: Z suffix, or utc called
  if (input.includes("Z") || input.endsWith("Z")) {
    return "utc";
  }
  // Operations: contains spaces or multiple parts
  if (input.includes(" ") && /\d/.test(input)) {
    return "operations";
  }
  // Grammar: long complex ISO strings
  if (input.length > 20 && /T/.test(input)) {
    return "grammar";
  }
  return "parse";
}

function importCrashFiles(): void {
  console.log("\n=== Importing crash files ===");
  if (!existsSync(CRASHES_DIR)) {
    console.log("  No crashes dir found");
    return;
  }
  const files = readdirSync(CRASHES_DIR).filter((f) => f !== ".gitkeep");
  for (const file of files) {
    const content = readFileSync(resolve(CRASHES_DIR, file));
    const inputStr = content.toString("utf-8");
    const category = determineCategory(inputStr);
    // Use filename as name basis, but make it readable
    const name = `crash-${file.replace(/^crash-/, "").slice(0, 12)}`;
    writeEntry(category, name, inputStr, {
      target: category,
      bugClass: "fuzzer crash",
      oracle: "upstream moment.js",
      added: new Date().toISOString().split("T")[0],
      source: `crash file: ${file}`,
      expected: { isValid: undefined },
    });
  }
}

function importFixedBugs(): void {
  console.log("\n=== Importing FIXED parse bugs ===");

  const fixedParse = [
    "constructoror.",
    "",
    "2008-W01",
    "2009-W01",
    "2008-W01-3",
    "2008W01",
    "2008W013",
    "-055555-05",
    "-000700-005",
    "-881802-88",
  ];

  const fixedUtc = [
    "constructoror.",
    "",
    "0010",
    "0011",
    "0000",
    "0066",
    "0050",
    "0055",
    "-110990-09",
  ];

  const knownDiffs = [
    {
      input: "93280531 09-3911",
      category: "parse",
      bugClass: "mixed format parse",
      failureDesc: "Different local-time rendering for compact date with time offset",
      expectedIsValid: true,
      expectedValueOf: 232209245460000,
    },
  ];

  for (const input of fixedParse) {
    const name = slugify(`fixed-parse-${input.slice(0, 20)}`);
    writeEntry("parse", name, input, {
      target: "parse",
      bugClass: "fixed parse crash",
      oracle: "upstream moment.js",
      added: "2026-05-17",
      source: "test/regression/crashes.test.ts (FIXED_PARSE)",
      expected: { isValid: undefined },
    });
  }

  for (const input of fixedUtc) {
    const name = slugify(`fixed-utc-${input.slice(0, 20)}`);
    writeEntry("utc", name, input, {
      target: "utc",
      bugClass: "fixed utc crash",
      oracle: "upstream moment.js",
      added: "2026-05-17",
      source: "test/regression/crashes.test.ts (FIXED_UTC)",
      expected: { isValid: undefined },
    });
  }

  for (const diff of knownDiffs) {
    const name = slugify(`known-diff-${diff.input.slice(0, 20)}`);
    writeEntry(diff.category, name, diff.input, {
      target: diff.category,
      bugClass: diff.bugClass,
      oracle: "upstream moment.js",
      added: "2026-05-17",
      failureDescription: diff.failureDesc,
      expected: {
        isValid: diff.expectedIsValid,
        valueOf: diff.expectedValueOf,
      },
    });
  }

  // Add the "0006W01Z" edge case
  writeEntry("parse", "week-date-timezone-without-time", "0006W01Z", {
    target: "parse",
    bugClass: "timezone without time in ISO week date",
    oracle: "upstream moment.js",
    added: "2026-05-17",
    source: "test/regression/crashes.test.ts",
    expected: { isValid: false },
  });
}

function importPastBugs(): void {
  console.log("\n=== Importing past fixed bugs ===");

  const pastBugs: { input: string; category: string; name: string; bugClass: string; failureDesc: string }[] = [
    {
      input: "0000 03",
      category: "parse",
      name: "year-0000-with-space",
      bugClass: "year 0000 parsing",
      failureDesc: "moment.utc() fallback overwriting ISO parser result",
    },
    {
      input: "+2222121222",
      category: "parse",
      name: "greedy-regex-overmatch",
      bugClass: "YYYYYY regex greedy match",
      failureDesc: "6-digit year regex captured too many digits",
    },
    {
      input: "-775505110",
      category: "parse",
      name: "dash-separated-YYYYMMDD-sign",
      bugClass: "dash-separated YYYYMMDD with sign",
      failureDesc: "sign not preserved in YYYYMMDD format",
    },
    {
      input: "8888W81",
      category: "parse",
      name: "iso-week-81-overflow",
      bugClass: "ISO week overflow detection",
      failureDesc: "week 81 not detected as overflow",
    },
    {
      input: "-0501350128",
      category: "parse",
      name: "YYYYYYMMDD-sign-retention",
      bugClass: "YYYYYYMMDD sign retention",
      failureDesc: "sign dropped in compact YYYYMMDD format",
    },
    {
      input: "+085501-757",
      category: "parse",
      name: "DDD-regex-fix",
      bugClass: "DDD regex too restrictive",
      failureDesc: "DDD regex required exactly 3 digits (d{3} fix)",
    },
    {
      input: "[2024,12,1]",
      category: "arrays",
      name: "month-12-overflow",
      bugClass: "month overflow via array constructor",
      failureDesc: "moment.utc([2024,5,15,12,30]) treated as local time",
    },
    {
      input: "2024-02-30T00:00:00+14:15",
      category: "parse-zone",
      name: "invalid-date-with-extreme-tz",
      bugClass: "invalid date with extreme timezone offset",
      failureDesc: "overflow not detected when combined with timezone",
    },
  ];

  for (const bug of pastBugs) {
    writeEntry(bug.category, bug.name, bug.input, {
      target: bug.category,
      bugClass: bug.bugClass,
      oracle: "upstream moment.js",
      added: "2026-05-17",
      failureDescription: bug.failureDesc,
      expected: { isValid: undefined },
    });
  }
}

function importStatefulBugs(): void {
  console.log("\n=== Importing stateful model found bugs ===");

  const statefulBugs: { input: string; name: string; bugClass: string; failureDesc: string }[] = [
    {
      input: "1970-01-01",
      name: "startOf-quarter-offset",
      bugClass: "startOf quarter offset not refreshed",
      failureDesc: "_startOfLocal returned before updating _offset for QUARTER/WEEK/ISO_WEEK",
    },
    {
      input: "1970-01-01",
      name: "endOf-quarter-offset",
      bugClass: "endOf quarter offset not refreshed",
      failureDesc: "_endOfLocal returned before updating _offset for QUARTER/WEEK/ISO_WEEK",
    },
    {
      input: "1970-01-01",
      name: "addSimple-missing-offset",
      bugClass: "_addSimple missing offset refresh for year/quarter/month",
      failureDesc: "_addSimple did not update _offset after local year/quarter/month mutation",
    },
  ];

  for (const bug of statefulBugs) {
    writeEntry("stateful", bug.name, bug.input, {
      target: "stateful",
      bugClass: bug.bugClass,
      oracle: "upstream moment.js",
      added: "2026-05-17",
      failureDescription: bug.failureDesc,
      expected: { isValid: true },
    });
  }
}

function main(): void {
  console.log("Importing regression entries...");
  importCrashFiles();
  importFixedBugs();
  importPastBugs();
  importStatefulBugs();

  // Summary
  let total = 0;
  const cats = readdirSync(REGRESSION);
  for (const cat of cats) {
    const catPath = resolve(REGRESSION, cat);
    if (!existsSync(catPath) || !statSync(catPath).isDirectory()) continue;
    const entries = readdirSync(catPath).filter((e) => e !== ".gitkeep");
    if (entries.length > 0) {
      console.log(`  ${cat}: ${entries.length} entries`);
      total += entries.length;
    }
  }
  console.log(`\nTotal regression entries: ${total}`);
}

main();
