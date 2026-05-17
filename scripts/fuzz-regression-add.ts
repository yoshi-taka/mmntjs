#!/usr/bin/env bun
/**
 * fuzz-regression-add.ts — Add a reduction-preserving regression entry.
 *
 * Usage:
 *   bun run scripts/fuzz-regression-add.ts <category> <name> [--input <string> | --file <path>]
 *
 * Interactive:
 *   bun run scripts/fuzz-regression-add.ts parse invalid-date-overflow \
 *     --input "2024-02-30" \
 *     --bug-class "overflow detection" \
 *     --expected-isValid false
 *
 * From file:
 *   bun run scripts/fuzz-regression-add.ts parse crash-1234 \
 *     --file crash-1234 \
 *     --bug-class "parse crash" \
 *     --oracle "upstream moment.js"
 *
 * Categories: parse, grammar, parse-zone, duration, locale, timezone, utc,
 *             format, strict, arrays, objects, operations, diff, stateful
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const REGRESSION = resolve(ROOT, "test", "fuzz", "regression");

const VALID_CATEGORIES = new Set([
  "parse", "grammar", "parse-zone", "duration", "locale", "timezone",
  "utc", "format", "strict", "arrays", "objects", "operations", "diff", "stateful",
]);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseArgs(): {
  category: string;
  name: string;
  input: string;
  bugClass: string;
  oracle: string;
  expectedIsValid: string;
  expectedValueOf: string;
  relatedCommit: string;
  failureDesc: string;
} {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: bun run scripts/fuzz-regression-add.ts <category> <name> [options]");
    console.error("");
    console.error("Options:");
    console.error("  --input <string>       The minimized input string");
    console.error("  --file <path>          Read input from file");
    console.error("  --bug-class <string>   Bug classification (e.g. 'overflow', 'parse crash')");
    console.error("  --oracle <string>      Oracle source (default: 'upstream moment.js')");
    console.error("  --expected-isValid     Expected isValid value (true/false)");
    console.error("  --expected-valueOf     Expected valueOf (number)");
    console.error("  --related-commit       Related git commit hash");
    console.error("  --failure-desc         Description of the failure before fix");
    console.error("");
    console.error("Categories:", [...VALID_CATEGORIES].join(", "));
    process.exit(1);
  }

  const category = args[0];
  if (!VALID_CATEGORIES.has(category)) {
    console.error(`Invalid category: ${category}. Valid: ${[...VALID_CATEGORIES].join(", ")}`);
    process.exit(1);
  }

  const rawName = args[1];
  const name = slugify(rawName);

  const opts: Record<string, string> = {};
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1];
      if (val && !val.startsWith("--")) {
        opts[key] = val;
        i++;
      } else {
        opts[key] = "true";
      }
    }
  }

  let input = opts.input ?? "";

  if (opts.file) {
    const filePath = resolve(opts.file);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    input = readFileSync(filePath, "utf-8");
  }

  if (!input && opts.input) {
    input = opts.input;
  }

  return {
    category,
    name,
    input,
    bugClass: opts["bug-class"] ?? "unknown",
    oracle: opts.oracle ?? "upstream moment.js",
    expectedIsValid: opts["expected-isValid"] ?? "",
    expectedValueOf: opts["expected-valueOf"] ?? "",
    relatedCommit: opts["related-commit"] ?? "",
    failureDesc: opts["failure-desc"] ?? "",
  };
}

function main(): void {
  const entry = parseArgs();

  const dirPath = resolve(REGRESSION, entry.category, entry.name);
  if (existsSync(dirPath)) {
    console.error(`Entry already exists at ${dirPath}`);
    console.error("Use a different name or remove the existing entry.");
    process.exit(1);
  }

  mkdirSync(dirPath, { recursive: true });

  // Write input file
  if (entry.input) {
    const inputPath = resolve(dirPath, "input");
    writeFileSync(inputPath, entry.input, "utf-8");
  }

  // Write metadata
  const meta = {
    target: entry.category,
    name: entry.name,
    added: new Date().toISOString().split("T")[0],
    oracle: entry.oracle,
    bugClass: entry.bugClass,
    relatedCommit: entry.relatedCommit || undefined,
    failureDescription: entry.failureDesc || undefined,
    expected: {
      isValid: entry.expectedIsValid ? entry.expectedIsValid === "true" : undefined,
      valueOf: entry.expectedValueOf ? Number(entry.expectedValueOf) : undefined,
    },
    inputLength: entry.input.length,
  };

  const metaPath = resolve(dirPath, "meta.json");
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");

  console.log(`Regression entry created:`);
  console.log(`  Path:     ${dirPath}`);
  console.log(`  Category: ${entry.category}`);
  console.log(`  Name:     ${entry.name}`);
  if (entry.input) {
    console.log(`  Input:    ${entry.input.length > 60 ? entry.input.slice(0, 60) + "..." : entry.input}`);
  }
  console.log(`  Bug class: ${entry.bugClass}`);
}

main();
