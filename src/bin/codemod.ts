import fs from "node:fs";
import { walkSourceFiles } from "./walk-source-files";

const IMPORT_PATTERNS = [
  { from: /from\s+['"]moment['"]/g, to: "from 'mmntjs'" },
  { from: /require\(['"]moment['"]\)/g, to: "require('mmntjs')" },
  { from: /from\s+['"]moment\/locale\//g, to: "from 'mmntjs/locale/" },
  { from: /require\(['"]moment\/locale\//g, to: "require('mmntjs/locale/" },
  { from: /import\s+(\w+)\s+from\s+['"]moment['"]/g, to: "import $1 from 'mmntjs'" },
];

const LOCALE_IMPORT_RE = /(?:from|require)\s*\(?\s*['"](?:moment|mmntjs)\/locale\/(\w+[-\w]*)/g;

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
    console.log("  mmntjs locales do not auto-register on import.");
    console.log("  Replace each import with:\n");
    console.log("    import { <name>Locale } from 'mmntjs/locale/<name>';");
    console.log('    moment.defineLocale("<name>", <name>Locale);\n');
  }
  console.log(`\n${results.total} import(s) can be auto-migrated (import path replacement only)`);
  console.log("Run `mmntjs migrate --apply` to apply changes\n");
}

export function runApply(dir = ".") {
  const results = scanFiles(dir);
  let modified = 0;
  for (const file of results.modifiedFiles) {
    let content = fs.readFileSync(file, "utf-8");
    const original = content;
    for (const pattern of IMPORT_PATTERNS) {
      content = content.replace(pattern.from, pattern.to);
    }
    if (content !== original) {
      fs.writeFileSync(file, content, "utf-8");
      modified++;
      console.log(`  ✓ ${file}`);
    }
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
    if (count > 0) {
      results.total += count;
      results.files++;
      results.fileCounts[p] = count;
      results.modifiedFiles.push(p);
    }
  });
  return results;
}
