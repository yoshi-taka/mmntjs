#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");
const localeDir = join(rootDir, "dist", "locale");
const outDir = join(rootDir, "dist", "locale-auto");

const dryRun = process.argv.includes("--dry-run");

function esmSource(name: string): string {
  return [
    'import moment from "../index.js";',
    `import * as localeModule from "../locale/${name}.js";`,
    "",
    `moment.locale("${name}", localeModule[Object.keys(localeModule)[0]]);`,
    "",
  ].join("\n");
}

function cjsSource(name: string): string {
  return [
    'const moment = require("../index.cjs");',
    `const localeModule = require("../locale/${name}.cjs");`,
    "",
    `moment.locale("${name}", localeModule[Object.keys(localeModule)[0]]);`,
    "",
  ].join("\n");
}

function dtsSource(): string {
  return "export {};\n";
}

function syncFile(filePath: string, next: string): boolean {
  const prev = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
  if (prev === next) {
    return false;
  }
  if (!dryRun) {
    writeFileSync(filePath, next, "utf-8");
  }
  return true;
}

const localeNames = readdirSync(localeDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => file.slice(0, -3))
  .filter((name) => name !== "test-locales")
  .sort();

const expected = new Set<string>();
for (const name of localeNames) {
  expected.add(`${name}.js`);
  expected.add(`${name}.cjs`);
  expected.add(`${name}.d.ts`);
  expected.add(`${name}.d.cts`);
}

const existing = existsSync(outDir) ? new Set(readdirSync(outDir, { recursive: false })) : new Set<string>();
const toWrite: string[] = [];
const toRemove: string[] = [];

if (!dryRun) {
  mkdirSync(outDir, { recursive: true });
}

for (const name of localeNames) {
  if (syncFile(join(outDir, `${name}.js`), esmSource(name))) {
    toWrite.push(`${name}.js`);
  }
  if (syncFile(join(outDir, `${name}.cjs`), cjsSource(name))) {
    toWrite.push(`${name}.cjs`);
  }
  if (syncFile(join(outDir, `${name}.d.ts`), dtsSource())) {
    toWrite.push(`${name}.d.ts`);
  }
  if (syncFile(join(outDir, `${name}.d.cts`), dtsSource())) {
    toWrite.push(`${name}.d.cts`);
  }
}

for (const fileName of existing) {
  if (!expected.has(fileName)) {
    toRemove.push(fileName);
  }
}

console.log(`locale-auto wrappers: ${localeNames.length}`);
if (toWrite.length > 0) {
  console.log(`write ${toWrite.length}: ${toWrite.join(", ")}`);
}
if (toRemove.length > 0) {
  console.log(`remove ${toRemove.length}: ${toRemove.join(", ")}`);
}
if (toWrite.length === 0 && toRemove.length === 0) {
  console.log("no changes");
}

if (!dryRun) {
  for (const fileName of toRemove) {
    rmSync(join(outDir, fileName), { force: true });
  }
}
