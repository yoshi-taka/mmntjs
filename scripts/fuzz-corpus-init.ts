#!/usr/bin/env bun
/**
 * fuzz-corpus-init.ts — Initialize/corpus directories with seed inputs.
 *
 * Extracts known edge cases from the test suite and writes them as
 * individual files in the appropriate corpus subdirectory.
 *
 * Run: bun run scripts/fuzz-corpus-init.ts
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CORPUS = resolve(ROOT, "test", "fuzz", "corpus");

interface Seed {
  dir: string;
  filename: string;
  content: string | Buffer;
  source: string;
}

// ---------------------------------------------------------------------------
// Known edge cases — organized by target area
// ---------------------------------------------------------------------------

function seeds(): Seed[] {
  const result: Seed[] = [];
  let id = 0;
  const next = (dir: string, content: string, source: string) => {
    id++;
    // Use content hash for filename stability
    const hash = hashStr(content);
    result.push({ dir, filename: hash, content, source });
  };

  // --- Parse seeds ---
  for (const s of parseSeeds()) next("parse", s, "edge-case");
  // --- Grammar seeds ---
  for (const s of grammarSeeds()) next("grammar", s, "grammar");
  // --- ParseZone seeds ---
  for (const s of parseZoneSeeds()) next("parse-zone", s, "edge-case");
  // --- Duration seeds ---
  for (const s of durationSeeds()) next("duration", s, "edge-case");
  // --- Format seeds ---
  for (const s of formatSeeds()) next("format", s, "edge-case");
  // --- Strict seeds ---
  for (const s of strictSeeds()) next("strict", s, "edge-case");
  // --- Locale seeds ---
  for (const s of localeSeeds()) next("locale", s, "edge-case");
  // --- Array construction seeds ---
  for (const s of arraySeeds()) next("arrays", s, "edge-case");
  // --- Object construction seeds ---
  for (const s of objectSeeds()) next("objects", s, "edge-case");
  // --- UTC seeds ---
  for (const s of utcSeeds()) next("utc", s, "edge-case");
  // --- Diff seeds ---
  for (const s of diffSeeds()) next("diff", s, "edge-case");

  return result;
}

function parseSeeds(): string[] {
  return [
    // Basic valid
    "2024-01-15",
    "2024-06-15T12:30:00",
    "2024-06-15T12:30:00Z",
    "2024-06-15T12:30:00+05:30",
    "2024-06-15 12:30:00",
    // Week dates
    "2024-W01-1",
    "2024-W01",
    "2024W011",
    "2024W01",
    // Ordinal dates
    "2024-001",
    "2024-366",
    "2024001",
    "2024366",
    // Compact dates
    "20240115",
    "20240615T123000Z",
    // Signed extended years
    "+002024-01-15",
    "-000001-01-01",
    "+001234-06-15",
    // Month-year only
    "2024-06",
    "202406",
    // Leap year
    "2024-02-29",
    "2024-02-29T12:00:00",
    // Invalid but syntactically valid
    "2024-02-30",
    "2023-02-29",
    "2024-04-31",
    // Overflow edges
    "2024-00-01",
    "2024-13-01",
    "2024-01-00",
    "2024-01-32",
    // Time overflow
    "2024-01-15T24:00:00",
    "2024-01-15T00:60:00",
    "2024-01-15T00:00:60",
    // Fractional seconds
    "2024-01-15T12:30:45.123",
    "2024-01-15T12:30:45,789",
    "2024-01-15T12:30:45.123456",
    // English month names
    "January 15 2024",
    "Jan 15 2024",
    // RFC 2822
    "Mon, 15 Jan 2024 12:30:00 +0000",
    "15 Jan 2024 12:30:00 GMT",
    // Known regression triggers
    "0000-01-01",
    "0050-01-01",
    "0066-01-01",
    "0010-01-01",
    "0011-01-01",
  ];
}

function grammarSeeds(): string[] {
  return [
    // Grammar-generated variants that exercise specific branches
    "2024-01-15T10:30:45.123456Z",
    "2024-01-15T10:30:45,123456+05:30",
    "2024-01-15T10:30:45.123456+0530",
    "2024W011T103045Z",
    "2024-001T10:30:45",
    "2024-366T10:30:45",
    "+002024-01-15T10:30:45",
    "-000001-01-01T00:00:00Z",
    "2024-W01-1T10:30:45",
    "2024-06T10:30:45",
    "2024-06-15T10:30:45.123",
    "2024-06-15 10:30:45",
    "20240615 103045",
    "2024-06-15 10:30:45.123456",
    "2024-06-15T10:30:45,123",
    "2024-06-15T10:30:45+14:00",
    "2024-06-15T10:30:45-12:00",
  ];
}

function parseZoneSeeds(): string[] {
  return [
    "2024-01-15T12:00:00+05:30",
    "2024-01-15T12:00:00-05:00",
    "2024-01-15T12:00:00Z",
    "2024-01-15T12:00:00+14:00",
    "2024-01-15T12:00:00-12:00",
    "2024-01-15T12:00:00+00:00",
    "2024-01-15 12:00:00+05:30",
    // Compact offset
    "2024-01-15T12:00:00+0530",
    "2024-01-15T12:00:00-0500",
    "2024-01-15T12:00:00+14:00",
  ];
}

function durationSeeds(): string[] {
  return [
    // JSON-serialized duration objects
    '{"hours":5}',
    '{"minutes":30}',
    '{"seconds":45}',
    '{"milliseconds":500}',
    '{"days":7}',
    '{"weeks":2}',
    '{"months":3}',
    '{"years":1}',
    '{"hours":1,"minutes":30}',
    '{"days":1,"hours":12}',
    '{"years":1,"months":6,"days":15}',
    '{"hours":0}',
    '{}',
    // ISO duration strings
    "P5H",
    "P30M",
    "P45S",
    "PT5H30M",
    "P1DT12H",
    "P1Y6M15D",
    "P0D",
    // Number durations
    "3600000",
    "86400000",
  ];
}

function formatSeeds(): string[] {
  return [
    "YYYY-MM-DD",
    "YYYY/MM/DD",
    "DD-MM-YYYY",
    "MM/DD/YYYY",
    "YYYY-MM-DD HH:mm",
    "YYYY-MM-DD HH:mm:ss",
    "YYYY-MM-DDTHH:mm:ssZ",
    "MMMM Do YYYY",
    "MMM Do YY",
    "dddd, MMMM Do YYYY",
    "h:mm A",
    "h:mm:ss a",
    "HH:mm:ss.SSS",
    "LT",
    "LTS",
    "L",
    "LL",
    "LLL",
    "LLLL",
    "YYYY",
    "YY",
    "GGGG",
    "WW",
    "DDD",
    "X",
    "x",
    "ZZ",
    "Z",
    "Q",
    "Mo",
    "Do",
    "YYYY [escaped] MM",
  ];
}

function strictSeeds(): string[] {
  return [
    // Format + input pairs (pipe-separated: format|input)
    "YYYY-MM-DD|2024-01-15",
    "YYYY-MM-DD|2024/01/15",
    "YYYY/MM/DD|2024/01/15",
    "DD-MM-YYYY|15-01-2024",
    "MM/DD/YYYY|01/15/2024",
    "YYYY-MM-DD HH:mm|2024-01-15 12:30",
    "YYYY-MM-DD HH:mm:ss|2024-01-15 12:30:45",
    "MMMM DD YYYY|January 15 2024",
    "MMM DD YYYY|Jan 15 2024",
    "HH:mm:ss|12:30:45",
    "hh:mm A|12:30 PM",
    "YYYY-MM-DDTHH:mm:ssZ|2024-01-15T12:30:00Z",
    // Known strict-mode failures
    "YYYY|2024-01-15",
    "YYYY-MM-DD|2024",
  ];
}

function localeSeeds(): string[] {
  return [
    "en",
    "fr",
    "de",
    "ja",
    "ru",
    "es",
    "zh-cn",
    "pt-br",
    "ko",
    "it",
    "nl",
    "sv",
    "2024-01-15",
    "January 15 2024",
    "15 January 2024",
    "2024",
  ];
}

function arraySeeds(): string[] {
  // JSON arrays for moment([y, M, d, h, m, s, ms])
  return [
    "[2024,0,15]",
    "[2024,0,15,12,30,0,0]",
    "[2024,11,31]",
    "[2024,1,29]",
    "[2023,1,28]",
    "[2000,0,1]",
    "[0,0,1]",
    "[99,0,1]",
    "[2024,0,1,24,0,0,0]",
    "[2024,0,1,0,60,0,0]",
    "[2024,0,1,0,0,60,0]",
    "[2024,0,1,0,0,0,1000]",
  ];
}

function objectSeeds(): string[] {
  return [
    '{"year":2024,"month":0,"day":15}',
    '{"year":2024,"month":0,"day":15,"hour":12,"minute":30}',
    '{"y":2024,"M":0,"d":15}',
    '{"years":2024,"months":0,"days":15}',
    '{"year":2024,"month":0,"day":32}',
    '{"year":2024,"month":12,"day":1}',
    '{"hour":12,"minute":30,"second":0}',
  ];
}

function utcSeeds(): string[] {
  return [
    "2024-01-15T12:30:00Z",
    "2024-01-15T12:30:00+00:00",
    "2024-06-15T10:30:00Z",
    "2024-01-15T12:30:00.123Z",
    "2024-01-15T12:30:00.123+05:30",
    "+002024-01-15T12:30:00Z",
    "2024-01-15",
    "2024-01-15T00:00:00Z",
    "20240115T123000Z",
    "2024-01-15T12:30:00-12:00",
    "2024-01-15T12:30:00+14:00",
  ];
}

function diffSeeds(): string[] {
  // Pairs: first|second
  return [
    "2024-01-15|2024-01-16",
    "2024-01-01|2025-01-01",
    "2024-06-15T12:30:00|2024-06-15T12:30:01",
    "2024-01-15|2024-01-15",
    "2024-01-01|2023-01-01",
    "2024-03-01|2024-03-10",
    "2024-01-15T00:00:00Z|2024-01-15T05:00:00+05:00",
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashStr(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, "0");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const allSeeds = seeds();

  // Group by directory
  const byDir = new Map<string, Seed[]>();
  for (const s of allSeeds) {
    if (!byDir.has(s.dir)) byDir.set(s.dir, []);
    byDir.get(s.dir)!.push(s);
  }

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const [dir, entries] of byDir) {
    const dirPath = resolve(CORPUS, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    const existing = new Set<string>();
    try {
      for (const f of readdirSync(dirPath)) {
        existing.add(f);
      }
    } catch {}

    for (const entry of entries) {
      if (existing.has(entry.filename)) {
        totalSkipped++;
        continue;
      }
      const content = typeof entry.content === "string" ? entry.content : entry.content.toString();
      writeFileSync(resolve(dirPath, entry.filename), content, "utf-8");
      totalWritten++;
    }
  }

  const total = totalWritten + totalSkipped;
  console.log(`Corpus init complete: ${totalWritten} written, ${totalSkipped} skipped (${total} total seeds)`);
  console.log(`Corpus directories:`);
  for (const [dir, entries] of byDir) {
    console.log(`  ${dir}: ${entries.length} seeds`);
  }
}

main();
