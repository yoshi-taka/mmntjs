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

// Transform a single locale import line into data import + defineLocale call.
// Handles both ESM and CJS patterns.
function transformLocaleImport(line: string): string {
  const m = line.match(LOCALE_IMPORT_RE);
  if (!m) { return line; }
  const name = m[1];
  if (/import\s/.test(line)) {
    return `import { ${name}Locale } from 'mmntjs/locale/${name}';\nmoment.defineLocale('${name}', ${name}Locale);`;
  }
  // CJS require('moment/locale/ja') or require('mmntjs/locale/ja')
  return `const { ${name}Locale } = require('mmntjs/locale/${name}');\nmoment.defineLocale('${name}', ${name}Locale);`;
}

export function runCheck(dir = ".") {
  const results = scanFiles(dir);
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
  console.log(`\nRun \`mmntjs migrate --apply\` to apply changes.`);
}

export function runApply(dir = ".") {
  const results = scanFiles(dir);
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
    if (content !== original) {
      fs.writeFileSync(file, content, "utf-8");
      modified++;
      console.log(`  ✓ ${file}`);
    }
  }
  if (results.localeFiles.length > 0) {
    console.log(`\n⚠  ${results.localeFiles.length} file(s) had locale imports transformed.`);
    console.log(
      "  Verify that `moment` is available in scope for the generated defineLocale calls.",
    );
  }
  console.log(`\nUpdated import paths in ${modified} file(s).`);
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
