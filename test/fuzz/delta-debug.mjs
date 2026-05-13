/**
 * Delta Debugging post-hoc minimizer for crash files.
 *
 * Usage:
 *   bun test/fuzz/delta-debug.mjs <crash-file-path> [harness-name]
 *
 * Reads a crash file, runs it against the given fuzz harness,
 * and reduces it to a minimal reproducing input.
 *
 * If no harness name is given, uses parse.fuzz.js (the default).
 * Example:
 *   bun test/fuzz/delta-debug.mjs crash-xxx parse
 *   bun test/fuzz/delta-debug.mjs crash-yyy operations
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ddmin algorithm ──────────────────────────────────────────────

function ddmin(input, test) {
  if (input.length === 0) {
    return input;
  }

  let n = 2;
  const active = input.slice();

  while (active.length > 1) {
    const step = Math.max(1, Math.floor(active.length / n));
    let start = 0;
    let reduced = false;

    while (start < active.length) {
      const end = Math.min(start + step, active.length);
      const candidate = active.slice(0, start).concat(active.slice(end));

      if (candidate.length < active.length && test(candidate)) {
        active.splice(start, end - start);
        n = Math.max(2, n - 1);
        reduced = true;
        break;
      }
      start = end;
    }

    if (!reduced) {
      if (n >= active.length) {
        break;
      }
      n = Math.min(n * 2, active.length);
    }
  }

  return active;
}

// ── Fuzz harnesses ───────────────────────────────────────────────

import moment from "../../dist/index.js";
import origMoment from "../../moment/moment.js";

function fuzzParse(buf) {
  const str = buf.toString("utf-8");
  const m2 = moment(str);
  const mo = origMoment(str);
  if (m2.isValid() !== mo.isValid()) {
    return true;
  }
  if (m2.isValid()) {
    if (m2.valueOf() !== mo.valueOf()) {
      return true;
    }
    if (m2.format("YYYY-MM-DD HH:mm:ss") !== mo.format("YYYY-MM-DD HH:mm:ss")) {
      return true;
    }
  }
  return false;
}

function fuzzUtc(buf) {
  const str = buf.toString("utf-8");
  const m2 = moment.utc(str);
  const mo = origMoment.utc(str);
  if (m2.isValid() !== mo.isValid()) {
    return true;
  }
  if (m2.isValid()) {
    if (m2.valueOf() !== mo.valueOf()) {
      return true;
    }
    if (m2.format("YYYY-MM-DD HH:mm:ss.SSS") !== mo.format("YYYY-MM-DD HH:mm:ss.SSS")) {
      return true;
    }
    if (m2.toISOString() !== mo.toISOString()) {
      return true;
    }
  }
  return false;
}

const harnesses = { parse: fuzzParse, utc: fuzzUtc };

// ── Main ─────────────────────────────────────────────────────────

const [crashPath, harnessName = "parse"] = process.argv.slice(2);

if (!crashPath) {
  console.error("Usage: bun test/fuzz/delta-debug.mjs <crash-file> [harness]");
  console.error("  harness: parse (default), utc");
  process.exit(1);
}

const harness = harnesses[harnessName];
if (!harness) {
  console.error(`Unknown harness: ${harnessName}. Available: ${Object.keys(harnesses).join(", ")}`);
  process.exit(1);
}

const absPath = resolve(process.cwd(), crashPath);
const original = readFileSync(absPath);

console.log(`Input: ${JSON.stringify(original.toString())} (${original.length} bytes)`);

// Confirm it reproduces
if (!harness(original)) {
  console.log("Input does NOT reproduce the failure. Nothing to minimize.");
  process.exit(0);
}

const result = ddmin([...original], (candidate) => harness(Buffer.from(candidate)));
const resultBuf = Buffer.from(result);

console.log(`Result: ${JSON.stringify(resultBuf.toString())} (${resultBuf.length} bytes)`);

if (resultBuf.length < original.length) {
  const outPath = `${absPath}.min`;
  writeFileSync(outPath, resultBuf);
  console.log(`Minimized crash written to: ${outPath}`);
} else {
  console.log("Already minimal.");
}
