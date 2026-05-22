#!/usr/bin/env bun
/**
 * pbt-regression.ts — Add a regression test from a PBT counterexample.
 *
 * Usage (manual counterexample):
 *   bun run scripts/pbt-regression.ts \
 *     --seed 398565147 \
 *     --values '["1970-01-01T00:00:00.000Z","hour",24]' \
 *     --desc "set('hour',24) normalizes to 0"
 *
 * Usage (re-run from seed — requires exported property):
 *   bun run scripts/pbt-regression.ts \
 *     --seed 398565147 \
 *     --property "test/moment-class-extra.test.ts:set-random-values"
 *
 * Options:
 *   --seed       The fast-check seed that reproduced the failure
 *   --values     JSON array of counterexample values (manual mode)
 *   --desc       Human-readable test description
 *   --prop       Property reference (file:name) for seed replay (future)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CRASHES_FILE = resolve(ROOT, "test", "regression", "crashes.test.ts");

interface Args {
  seed: string;
  values?: unknown[];
  desc: string;
  prop?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1];
      if (val && !val.startsWith("--")) {
        opts[key] = val;
        i++;
      }
    }
  }

  if (!opts.seed) {
    console.error("Usage: bun run scripts/pbt-regression.ts --seed <N> --values <JSON> --desc <text>");
    console.error("       bun run scripts/pbt-regression.ts --seed <N> --prop <file:name>");
    process.exit(1);
  }

  let values: unknown[] | undefined;
  if (opts.values) {
    try {
      values = JSON.parse(opts.values);
      if (!Array.isArray(values)) throw new Error("not an array");
    } catch {
      console.error(`--values must be a JSON array, got: ${opts.values}`);
      process.exit(1);
    }
  }

  return {
    seed: opts.seed,
    values,
    desc: opts.desc || `PBT regression seed=${opts.seed}`,
    prop: opts.prop,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function genValueExpr(v: unknown): string {
  if (v instanceof Date) return `new Date("${v.toISOString()}")`;
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return String(v);
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function inferTestCode(vals: unknown[], desc: string, seed: string): string {
  // Try to generate meaningful test code based on value types.
  // Common PBT patterns:
  //   [Date, string, number] → moment(d).set(unit, val)
  //   [Date, Date] → moment(a).diff(b)
  //   [string] → moment(input)
  if (vals.length === 3 && vals[0] instanceof Date && typeof vals[1] === "string" && typeof vals[2] === "number") {
    const dExpr = genValueExpr(vals[0]);
    const unit = JSON.stringify(vals[1]);
    const val = String(vals[2]);
    return `
test("PBT: ${desc.replace(/"/g, '\\"')}", () => {
  const d = ${dExpr};
  const m2 = moment(d);
  const mo = originalMoment(d);
  m2.set(${unit}, ${val});
  mo.set(${unit}, ${val});
  expect(m2.valueOf()).toBe(mo.valueOf());
});`;
  }
  if (vals.length === 1 && typeof vals[0] === "string") {
    const input = JSON.stringify(vals[0]);
    return `
test("PBT: ${desc.replace(/"/g, '\\"')}", () => {
  const m2 = moment(${input});
  const mo = originalMoment(${input});
  expect(m2.isValid()).toBe(mo.isValid());
  if (m2.isValid() && mo.isValid()) {
    expect(m2.valueOf()).toBe(mo.valueOf());
  }
});`;
  }
  // Generic fallback
  const exprs = vals.map(genValueExpr).join(", ");
  return `
test("PBT: ${desc.replace(/"/g, '\\"')}", () => {
  const vals = [${exprs}];
  // TODO: adapt assertion to match the original property
  // seed=${seed}
});`;
}

function main(): void {
  const entry = parseArgs();

  if (!entry.values) {
    console.error("--values required for now (property replay not yet implemented)");
    process.exit(1);
  }

  const testCode = inferTestCode(entry.values, entry.desc, entry.seed);

  if (!existsSync(CRASHES_FILE)) {
    console.error(`crashes.test.ts not found at ${CRASHES_FILE}`);
    process.exit(1);
  }

  let content = readFileSync(CRASHES_FILE, "utf-8");

  // Insert before the last empty line or closing
  const insertMarker = "// ── Group 4: PBT counterexamples (fast-check property failures) ──";
  const insertPos = content.lastIndexOf(insertMarker);
  if (insertPos >= 0) {
    // Find the start of the next group marker
    const nextMarker = content.indexOf("// ── Group", insertPos + 1);
    const insertAt = nextMarker >= 0 ? nextMarker : content.lastIndexOf("\n\n");
    content =
      content.slice(0, insertAt) + "\n" + testCode + "\n" + content.slice(insertAt);
  } else {
    // Append after the PBT group header (add one if missing)
    const grp5 = "// ── Group 5:";
    const insAt = content.lastIndexOf(grp5);
    if (insAt >= 0) {
      content =
        content.slice(0, insAt) +
        "\n// ── Group 4: PBT counterexamples (fast-check property failures) ──\n" +
        testCode +
        "\n" +
        content.slice(insAt);
    } else {
      content += "\n" + testCode;
    }
  }

  writeFileSync(CRASHES_FILE, content, "utf-8");
  console.log(`✓ PBT regression added: ${entry.desc} (seed=${entry.seed})`);
  console.log(`  File: ${CRASHES_FILE}`);
}

main();
