#!/usr/bin/env bun
/**
 * Refactor: Replace #s private field + getter/setter pattern
 * with a plain `_p` store object for freeze safety + perf.
 *
 * Usage:
 *   bun scripts/refactor-to-_p-store.ts        # execute
 *   bun scripts/refactor-to-_p-store.ts --dry  # dry run
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = resolve(import.meta.dirname, "..");

// ── field mapping ──────────────────────────────────────────────────
// Format: [propertyAccessSuffix, storeKey]
const FIELD_MAP: Array<[fromProp: string, toKey: string]> = [
  ["$y", "y"],
  ["$M", "M"],
  ["$D", "D"],
  ["$W", "W"],
  ["$H", "H"],
  ["$m", "m"],
  ["$s", "s"],
  ["$ms", "ms"],
  ["_t", "t"],
  ["_d", "d"],
  ["_dirty", "dirty"],
  ["_isUTC", "isUTC"],
  ["_offset", "offset"],
  ["_locale", "locale"],
];

/** Escape regex special chars in a string */
function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── helpers ────────────────────────────────────────────────────────

function accessorOps(vars: string[]) {
  const r: Array<[RegExp, string]> = [];
  const varAlt = vars.join("|");
  for (const [fromProp, toKey] of FIELD_MAP) {
    const re = new RegExp(`\\b(${varAlt})\\.${escRegex(fromProp)}\\b`, "g");
    r.push([re, `$1._p.${toKey}`]);
  }
  return r;
}

// ── files to transform ─────────────────────────────────────────────

interface Transform {
  path: string;
  label: string;
  transforms: Array<{
    run: (content: string) => string;
    desc: string;
    expectChanges?: boolean; // if false, silence "not found" warnings
  }>;
}

const transforms: Transform[] = [];

// ── Core class files ───────────────────────────────────────────────

function buildCoreTransforms(label: string, hasDeclareFields: boolean): Transform["transforms"] {
  const t: Transform["transforms"] = [];

  // 1. Replace readonly #s = {  with _p = {
  t.push({
    run: (c) => c.replace("readonly #s = {", "_p = {"),
    desc: "#s declaration → _p",
  });

  // 2. Replace this.#s.X → this._p.X (in getter/setter bodies)
  t.push({
    run: (c) => c.replaceAll("this.#s.", "this._p."),
    desc: "this.#s. → this._p.",
  });

  // 3. Replace this.$y → this._p.y etc.
  for (const [re, repl] of accessorOps(["this"])) {
    t.push({ run: (c) => c.replace(re, repl), desc: `this.→_p` });
  }
  // 4. Other var names used inside the class
  for (const [re, repl] of accessorOps(["clone"])) {
    t.push({ run: (c) => c.replace(re, repl), desc: `clone.→_p` });
  }
  for (const [re, repl] of accessorOps(["m"]) /* target of clone() */) {
    t.push({ run: (c) => c.replace(re, repl), desc: `m.→_p` });
  }
  for (const [re, repl] of accessorOps(["a", "b"])) {
    t.push({ run: (c) => c.replace(re, repl), desc: `a|b.→_p` });
  }
  // 5. Remove all getter/setter blocks — 14 pairs total
  const getterSetterRegex =
    /\n  get _t\(\)[\s\S]*?this\._p\.ms = v;\n  }/;
  t.push({
    run: (c) => c.replace(getterSetterRegex, ""),
    desc: "remove all 14 getter/setter pairs",
  });

  return t;
}

transforms.push({
  path: resolve(ROOT, "src/moment-class.ts"),
  label: "moment-class.ts",
  transforms: buildCoreTransforms("moment-class", false),
});

transforms.push({
  path: resolve(ROOT, "src/moment-lite.ts"),
  label: "moment-lite.ts",
  transforms: buildCoreTransforms("moment-lite", false),
});

// ── External files ─────────────────────────────────────────────────

const EXTERNAL: Array<{ path: string; vars: string[]; label: string }> = [
  { path: "src/utc-extra.ts", vars: ["m", "clone", "next"], label: "utc-extra.ts" },
  { path: "src/boundary-extra.ts", vars: ["m"], label: "boundary-extra.ts" },
  { path: "src/calendar-extra.ts", vars: ["m"], label: "calendar-extra.ts" },
  { path: "src/locale-extra.ts", vars: ["m"], label: "locale-extra.ts" },
  { path: "src/debug-extra.ts", vars: ["m"], label: "debug-extra.ts" },
  { path: "src/format-tokens.ts", vars: ["m"], label: "format-tokens.ts" },
  { path: "src/display/format.ts", vars: ["m", "raw"], label: "display/format.ts" },
  { path: "src/display/format-basic.ts", vars: ["raw"], label: "display/format-basic.ts" },
  { path: "src/plugins/utc.ts", vars: ["m"], label: "plugins/utc.ts" },
  { path: "src/core/factory-lite-impl.ts", vars: ["m"], label: "factory-lite-impl.ts" },
  { path: "src/locale/ja.ts", vars: ["raw"], label: "locale/ja.ts" },
  { path: "src/temporal.ts", vars: ["m"], label: "temporal.ts" },
];

for (const f of EXTERNAL) {
  const t: Transform = {
    path: resolve(ROOT, f.path),
    label: f.label,
    transforms: [],
  };
  for (const [re, repl] of accessorOps(f.vars)) {
    t.transforms.push({ run: (c) => c.replace(re, repl), desc: `${f.vars.join("|")}.→_p` });
  }
  transforms.push(t);
}

// ── Execute ────────────────────────────────────────────────────────

let changedCount = 0;
let errorCount = 0;

for (const tf of transforms) {
  let content: string;
  try {
    content = readFileSync(tf.path, "utf-8");
  } catch {
    console.error(`❌ Cannot read: ${tf.label}`);
    errorCount++;
    continue;
  }

  const original = content;

  for (const t of tf.transforms) {
    content = t.run(content);
  }

  if (content === original) {
    console.log(`  ${tf.label}: no changes`);
    continue;
  }

  changedCount++;

  if (DRY) {
    const origLines = original.split("\n");
    const newLines = content.split("\n");
    let adds = 0, removes = 0;
    for (let i = 0; i < Math.max(origLines.length, newLines.length); i++) {
      if (origLines[i] !== newLines[i]) {
        if (origLines[i] !== undefined) removes++;
        if (newLines[i] !== undefined) adds++;
      }
    }
    console.log(`  ${tf.label}: ${origLines.length}→${newLines.length} lines (+${adds}/-${removes})`);
  } else {
    writeFileSync(tf.path, content, "utf-8");
    console.log(`  ✅ ${tf.label}`);
  }
}

console.log(`\n${DRY ? "DRY RUN: " : ""}${changedCount} files changed, ${errorCount} errors`);
if (DRY) {
  console.log("Run without --dry to apply.");
}
