#!/usr/bin/env bun
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const SRC_LOCALE = join(import.meta.dir, "..", "src", "locale");
const MOMENT_LOCALE = join(import.meta.dir, "..", "moment", "locale");

const skipLocales = new Set(["en", "de"]);

function camel(name: string): string {
  return name.split("-").map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join("");
}

function findMatchingBrace(code: string, startIdx: number, open: string, close: string): number {
  let depth = 0;
  let inString = false;
  let strChar = "";
  for (let i = startIdx; i < code.length; i++) {
    const ch = code[i];
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === strChar) inString = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inString = true;
      strChar = ch;
      continue;
    }
    // Skip regex literals (approximate)
    if (ch === "/" && i > 0 && /[(,=:[{!&|?;\s]$/.test(code[i - 1])) {
      for (let j = i + 1; j < code.length; j++) {
        if (code[j] === "\\") { j++; continue; }
        if (code[j] === "/") { i = j; break; }
      }
      continue;
    }
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function stripUMD(content: string): string | null {
  const bodyMarkers = [
    "(function (moment) { 'use strict';",
    "(function (moment) {\n    'use strict';",
    "(function (moment) {\n        'use strict';",
  ];
  let startIdx = -1;
  for (const m of bodyMarkers) {
    const idx = content.indexOf(m);
    if (idx !== -1) {
      startIdx = idx + m.length;
      break;
    }
  }
  if (startIdx === -1) return null;

  // Find the closing of the factory function by looking for the last `})));` pattern
  const endMatch = content.slice(startIdx).match(/\n\s+return\s+\w+\s*;\s*\n\s*\}\)\)\);/);
  if (!endMatch) return null;

  return content.slice(startIdx, startIdx + endMatch.index!).trim();
}

function convertFile(filePath: string): { name: string; ts: string } | null {
  let content = readFileSync(filePath, "utf-8");
  content = content.replace(/^\uFEFF/, "");

  const body = stripUMD(content);
  if (!body) return null;

  // Extract locale name and find defineLocale call
  const nameMatch = body.match(/moment\.defineLocale\(\s*['"]([^'"]+)['"]/);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  // Find the `var NAME = moment.defineLocale('name', ` pattern
  const defCallRegex = new RegExp(
    `var\\s+\\w+\\s*=\\s*moment\\.defineLocale\\(\\s*['"]${escapeRegex(name)}['"]\\s*,`,
  );
  const defMatch = body.match(defCallRegex);
  if (!defMatch) {
    // Try without var assignment
    const altMatch = body.match(new RegExp(`moment\\.defineLocale\\(\\s*['"]${escapeRegex(name)}['"]\\s*,`));
    if (!altMatch) return null;
    // Extract config object
    const configStart = altMatch.index! + altMatch[0].length;
    const braceEnd = findMatchingBrace(body, configStart, "{", "}");
    if (braceEnd === -1) return null;
    const configStr = body.slice(configStart, braceEnd);
    const variables = body.slice(0, altMatch.index!).trim();
    return buildModule(name, variables, configStr);
  }

  // Extract variables before defineLocale
  const variables = body.slice(0, defMatch.index!).trim();

  // Extract config object after defineLocale's opening
  const configStart = defMatch.index! + defMatch[0].length;
  const braceEnd = findMatchingBrace(body, configStart, "{", "}");
  if (braceEnd === -1) return null;
  const configStr = body.slice(configStart, braceEnd);

  return buildModule(name, variables, configStr);
}

function buildModule(name: string, variables: string, configStr: string): { name: string; ts: string } {
  const exportName = camel(name) + "Locale";

  let ts = `// @ts-nocheck\nimport type { LocaleSpec } from "./en";\n`;
  ts += `import { defineLocale } from "../locale";\n\n`;

  if (variables) {
    ts += variables + "\n\n";
  }

  ts += `export const ${exportName}: LocaleSpec = ${configStr};\n\n`;
  ts += `defineLocale("${name}", ${exportName});\n`;

  return { name, ts };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  if (!existsSync(SRC_LOCALE)) mkdirSync(SRC_LOCALE, { recursive: true });

  const files = readdirSync(MOMENT_LOCALE)
    .filter((f) => f.endsWith(".js"))
    .sort();

  const converted: { name: string }[] = [];
  const failed: string[] = [];

  for (const file of files) {
    const name = file.replace(/\.js$/, "");
    if (skipLocales.has(name)) continue;

    const filePath = join(MOMENT_LOCALE, file);
    const result = convertFile(filePath);

    if (!result) {
      failed.push(name);
      console.log(`FAIL ${name}`);
      continue;
    }

    const tsFile = join(SRC_LOCALE, `${result.name}.ts`);
    writeFileSync(tsFile, result.ts, "utf-8");
    converted.push({ name: result.name });
    console.log(`OK   ${result.name}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Converted: ${converted.length}`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.length}`);
    for (const f of failed) console.log(`  - ${f}`);
  }
}

main().catch(console.error);
