import fs from "node:fs";
import { walkSourceFiles } from "./walk-source-files";

const IMPORT_PATTERNS = [
  { from: /from\s+['"]moment['"]/g, to: "from 'mmntjs'" },
  { from: /require\(['"]moment['"]\)/g, to: "require('mmntjs')" },
  { from: /from\s+['"]moment\/locale\//g, to: "from 'mmntjs/locale/" },
  { from: /require\(['"]moment\/locale\//g, to: "require('mmntjs/locale/" },
  { from: /import\s+(\w+)\s+from\s+['"]moment['"]/g, to: "import $1 from 'mmntjs'" },
];

const LOCALE_IMPORT_RE =
  /(?:from|require|import)\s*\(?\s*['"](?:moment|mmntjs)\/locale\/(\w+[-\w]*)/;

// Detect dynamic locale calls like moment.locale('ja') or moment().locale('de')
const LOCALE_CALL_RE = /\.locale\(\s*['"]([a-z]{2}(?:-[a-z]{2})?)['"]\s*\)/g;

function transformLocaleImport(line: string): string {
  const m = line.match(LOCALE_IMPORT_RE);
  if (!m) { return line; }
  const name = m[1];
  if (/import\s/.test(line)) {
    return `import { ${name}Locale } from 'mmntjs/locale/${name}';\nmoment.defineLocale('${name}', ${name}Locale);`;
  }
  return `const { ${name}Locale } = require('mmntjs/locale/${name}');\nmoment.defineLocale('${name}', ${name}Locale);`;
}

/** Build a defineLocale preamble for locale names collected via dynamic calls */
function localePreamble(names: Set<string>, isEsm: boolean): string {
  const lines: string[] = [];
  for (const name of names) {
    if (name === "en") continue;
    if (isEsm) {
      lines.push(`import { ${name}Locale } from 'mmntjs/locale/${name}';`);
    } else {
      lines.push(`const { ${name}Locale } = require('mmntjs/locale/${name}');`);
    }
    lines.push(`moment.defineLocale('${name}', ${name}Locale);`);
  }
  return lines.join("\n");
}

export function runCheck(dir = ".") {
  const results = scanFiles(dir);
  if (!results.dynamicLocaleFiles) { (results as any).dynamicLocaleFiles = {}; }
  console.log(`\nFound ${results.total} moment import(s) in ${results.files} file(s):`);
  for (const [file, count] of Object.entries(results.fileCounts)) {
    console.log(`  ${file}: ${count} import(s)`);
  }
  if (results.localeFiles.length > 0) {
    console.log(`\n⚠  ${results.localeFiles.length} file(s) import moment locale:`);
    for (const file of results.localeFiles) {
      console.log(`  ${file}`);
    }
    console.log("  Will be transformed to explicit data import + defineLocale.\n");
  }
  const dynKeys = Object.keys(results.dynamicLocaleFiles);
  if (dynKeys.length > 0) {
    console.log(`\n⚠  ${dynKeys.length} file(s) use moment.locale() with string literals:`);
    for (const file of dynKeys) {
      console.log(`  ${file}: ${[...results.dynamicLocaleFiles[file]!].join(", ")}`);
    }
    console.log("  Will have import + defineLocale injected at file top.\n");
  }
  console.log(`\nRun \`mmntjs migrate --apply\` to apply changes.`);
}

export function runApply(dir = ".") {
  const results = scanFiles(dir);
  if (!results.dynamicLocaleFiles) { (results as any).dynamicLocaleFiles = {}; }
  let modified = 0;
  for (const file of results.modifiedFiles) {
    let content = fs.readFileSync(file, "utf-8");
    const original = content;
    // 1. Apply simple path replacements (non-locale imports)
    for (const pattern of IMPORT_PATTERNS) {
      content = content.replace(pattern.from, pattern.to);
    }
    // 2. Transform locale imports into data import + defineLocale
    const lines = content.split("\n");
    let hasLocaleTransform = false;
    for (let i = 0; i < lines.length; i++) {
      if (LOCALE_IMPORT_RE.test(lines[i])) {
        lines[i] = transformLocaleImport(lines[i]);
        hasLocaleTransform = true;
      }
    }
    if (hasLocaleTransform) {
      content = lines.join("\n");
    }
    // 3. Inject locale preamble for dynamic .locale() calls
    const dynamicLocales = results.dynamicLocaleFiles[file];
    if (dynamicLocales && dynamicLocales.size > 0) {
      const isEsm = /^import\s|^export\s/m.test(content);
      const preamble = localePreamble(dynamicLocales, isEsm);
      const existing = content.match(/^(import\s|const\s|require)/m);
      if (existing) {
        content = content.replace(/^/, preamble + "\n");
      } else {
        content = preamble + "\n" + content;
      }
    }
    if (content !== original) {
      fs.writeFileSync(file, content, "utf-8");
      modified++;
      console.log(`  ✓ ${file}`);
    }
  }
  if (results.localeFiles.length > 0 || Object.keys(results.dynamicLocaleFiles).length > 0) {
    console.log(`\n⚠  Locale imports added. Verify that \`moment\` is in scope.`);
  }
  console.log(`\nUpdated ${modified} file(s).`);
}

function scanFiles(dir: string) {
  const results = {
    total: 0,
    files: 0,
    fileCounts: {} as Record<string, number>,
    modifiedFiles: [] as string[],
    localeFiles: [] as string[],
    dynamicLocaleFiles: {} as Record<string, Set<string>>,
  };

  walkSourceFiles(dir, (p) => {
    const content = fs.readFileSync(p, "utf-8");
    if (LOCALE_IMPORT_RE.test(content)) {
      results.localeFiles.push(p);
    }
    // Detect dynamic locale calls
    const dynamicLocales = new Set<string>();
    let m: RegExpExecArray | null;
    LOCALE_CALL_RE.lastIndex = 0;
    while ((m = LOCALE_CALL_RE.exec(content)) !== null) {
      const name = m[1].toLowerCase();
      if (name !== "en") dynamicLocales.add(name);
    }
    if (dynamicLocales.size > 0) {
      results.dynamicLocaleFiles[p] = dynamicLocales;
    }
    let count = 0;
    for (const pattern of IMPORT_PATTERNS) {
      const matches = content.match(pattern.from);
      if (matches) { count += matches.length; }
    }
    const hasLocale = LOCALE_IMPORT_RE.test(content);
    if (count > 0 || hasLocale || dynamicLocales.size > 0) {
      results.total += count;
      results.files++;
      results.fileCounts[p] = count;
      results.modifiedFiles.push(p);
    }
  });
  return results;
}

function scanFiles(dir: string) {
  const results = {
    total: 0,
    files: 0,
    fileCounts: {} as Record<string, number>,
    modifiedFiles: [] as string[],
    localeFiles: [] as string[],
  };

  walkSourceFiles(dir, (p) => {
    const content = fs.readFileSync(p, "utf-8");
    // Check locale imports (not auto-migratable — needs manual defineLocale)
    if (LOCALE_IMPORT_RE.test(content)) {
      results.localeFiles.push(p);
    }
    let count = 0;
    for (const pattern of IMPORT_PATTERNS) {
      const matches = content.match(pattern.from);
      if (matches) {
        count += matches.length;
      }
    }
    const hasLocale = LOCALE_IMPORT_RE.test(content);
    if (count > 0 || hasLocale) {
      results.total += count;
      results.files++;
      results.fileCounts[p] = count;
      results.modifiedFiles.push(p);
    }
  });
  return results;
}
