import fs from "node:fs";
import { walkSourceFiles } from "./walk-source-files";

const IMPORT_PATTERNS = [
  { from: /from\s+['"]moment['"]/g, to: "from 'mmntjs'" },
  { from: /require\(['"]moment['"]\)/g, to: "require('mmntjs')" },
  { from: /from\s+['"]moment\/locale\//g, to: "from 'mmntjs/locale/" },
  { from: /require\(['"]moment\/locale\//g, to: "require('mmntjs/locale/" },
  { from: /import\s+(\w+)\s+from\s+['"]moment['"]/g, to: "import $1 from 'mmntjs'" },
  { from: /from\s+['"]moment-timezone['"]/g, to: "from 'mmntjs'" },
  { from: /require\(['"]moment-timezone['"]\)/g, to: "require('mmntjs')" },
  { from: /import\s+['"]moment-timezone['"]/g, to: "import 'mmntjs-timezone'" },
  { from: /import\s+(\w+)\s+from\s+['"]moment-timezone['"]/g, to: "import $1 from 'mmntjs'" },
];

const LOCALE_IMPORT_RE =
  /(?:from|require|import)\s*\(?\s*['"](?:moment|mmntjs)\/locale\/(\w+[-\w]*)/;

const LOCALE_CALL_RE = /\.locale\(\s*['"]([a-z]{2}(?:-[a-z]{2})?)['"]\s*\)/g;

// API patterns that require full mmntjs entry (not available in lite/fns)
const FULL_ONLY_RE = [
  { re: /\.locale\s*\(/, name: "locale" },
  { re: /\.defineLocale\s*\(/, name: "defineLocale" },
  { re: /\.updateLocale\s*\(/, name: "updateLocale" },
  { re: /\.locales\s*\(/, name: "locales" },
  { re: /moment\.utc\s*\(/, name: "moment.utc()" },
  { re: /moment\.parseZone\s*\(/, name: "moment.parseZone()" },
  { re: /moment\.duration\s*\(/, name: "moment.duration()" },
  { re: /moment\.invalid\s*\(/, name: "moment.invalid()" },
  { re: /moment\.locale\s*\(/, name: "moment.locale()" },
  { re: /moment\.defineLocale\s*\(/, name: "moment.defineLocale()" },
  { re: /moment\.updateLocale\s*\(/, name: "moment.updateLocale()" },
  { re: /moment\.locales\s*\(/, name: "moment.locales()" },
  { re: /moment\.lang\s*\(/, name: "moment.lang()" },
  { re: /moment\.months\s*\(/, name: "moment.months()" },
  { re: /moment\.weekdays\s*\(/, name: "moment.weekdays()" },
];

// API patterns available in mmntjs/fns (standalone functions)
const FNS_OK_RE = [
  { re: /\.format\s*\(/, name: "format" },
  { re: /\.startOf\s*\(/, name: "startOf" },
  { re: /\.endOf\s*\(/, name: "endOf" },
  { re: /\.add\s*\(/, name: "add" },
  { re: /\.subtract\s*\(/, name: "subtract" },
  { re: /\.diff\s*\(/, name: "diff" },
  { re: /\.isBefore\s*\(/, name: "isBefore" },
  { re: /\.isAfter\s*\(/, name: "isAfter" },
  { re: /\.isSame\s*\(/, name: "isSame" },
  { re: /\.isSameOrBefore\s*\(/, name: "isSameOrBefore" },
  { re: /\.isSameOrAfter\s*\(/, name: "isSameOrAfter" },
  { re: /\.isBetween\s*\(/, name: "isBetween" },
  { re: /\.clone\s*\(/, name: "clone" },
  { re: /\.year\s*\(/, name: "year" },
  { re: /\.month\s*\(/, name: "month" },
  { re: /\.date\s*\(/, name: "date" },
  { re: /\.hour\s*\(/, name: "hour" },
  { re: /\.minute\s*\(/, name: "minute" },
  { re: /\.second\s*\(/, name: "second" },
  { re: /\.millisecond\s*\(/, name: "millisecond" },
  { re: /\.day\s*\(/, name: "day" },
  { re: /\.unix\s*\(/, name: "unix" },
  { re: /\.valueOf\s*\(/, name: "valueOf" },
  { re: /\.toDate\s*\(/, name: "toDate" },
  { re: /\.toISOString\s*\(/, name: "toISOString" },
  { re: /\.toJSON\s*\(/, name: "toJSON" },
  { re: /\.setYear\s*\(/, name: "setYear" },
  { re: /\.setMonth\s*\(/, name: "setMonth" },
  { re: /\.setDate\s*\(/, name: "setDate" },
  { re: /\.setHours\s*\(/, name: "setHours" },
  { re: /\.setMinutes\s*\(/, name: "setMinutes" },
  { re: /\.setSeconds\s*\(/, name: "setSeconds" },
  { re: /\.setMilliseconds\s*\(/, name: "setMilliseconds" },
  { re: /\.isLeapYear\s*\(/, name: "isLeapYear" },
  { re: /\.dayOfYear\s*\(/, name: "dayOfYear" },
  { re: /\.daysInMonth\s*\(/, name: "daysInMonth" },
  { re: /\.quarter\s*\(/, name: "quarter" },
  { re: /\.week\s*\(/, name: "week" },
  { re: /\.isoWeek\s*\(/, name: "isoWeek" },
  { re: /\.weekday\s*\(/, name: "weekday" },
  { re: /\.isoWeekday\s*\(/, name: "isoWeekday" },
];

// API patterns available in lite entry but NOT in fns (need moment object)
const LITE_OK_RE = [
  { re: /moment\s*\(/, name: "moment()" },
  { re: /moment\.now\b/, name: "moment.now" },
  { re: /moment\.unix\s*\(/, name: "moment.unix()" },
  { re: /\.utc\s*\(/, name: "utc()" },
  { re: /\.utcOffset\s*\(/, name: "utcOffset()" },
  { re: /\.local\s*\(/, name: "local()" },
  { re: /\.fromNow\s*\(/, name: "fromNow" },
  { re: /\.from\s*\(/, name: "from" },
  { re: /\.toNow\s*\(/, name: "toNow" },
  { re: /\.to\s*\(/, name: "to" },
  { re: /\.calendar\s*\(/, name: "calendar" },
  { re: /\.isDST\s*\(/, name: "isDST" },
  { re: /\.isUTC\s*\(/, name: "isUTC" },
  { re: /\.zone\s*\(/, name: "zone" },
  { re: /\.zoneAbbr\s*\(/, name: "zoneAbbr" },
  { re: /\.zoneName\s*\(/, name: "zoneName" },
  { re: /moment\.max\s*\(/, name: "moment.max()" },
  { re: /moment\.min\s*\(/, name: "moment.min()" },
];

function transformLocaleImport(line: string): string {
  const m = line.match(LOCALE_IMPORT_RE);
  if (!m) {
    return line;
  }
  const name = m[1];
  if (/^\s*import\s+['"]/.test(line)) {
    return `import 'mmntjs/locale-auto/${name}';`;
  }
  if (/require\s*\(/.test(line)) {
    return `require('mmntjs/locale-auto/${name}');`;
  }
  if (/import\s/.test(line)) {
    return `import { ${name}Locale } from 'mmntjs/locale/${name}';\nmoment.defineLocale('${name}', ${name}Locale);`;
  }
  return `const { ${name}Locale } = require('mmntjs/locale/${name}');\nmoment.defineLocale('${name}', ${name}Locale);`;
}

/** Build a defineLocale preamble for locale names collected via dynamic calls */
function localePreamble(names: Set<string>, isEsm: boolean): string {
  const lines: string[] = [];
  for (const name of names) {
    if (name === "en") {
      continue;
    }
    if (isEsm) {
      lines.push(`import { ${name}Locale } from 'mmntjs/locale/${name}';`);
    } else {
      lines.push(`const { ${name}Locale } = require('mmntjs/locale/${name}');`);
    }
    lines.push(`moment.defineLocale('${name}', ${name}Locale);`);
  }
  return lines.join("\n");
}

type ApiUsage = {
  total: number;
  files: number;
  fileCounts: Record<string, number>;
  modifiedFiles: string[];
  localeFiles: string[];
  dynamicLocaleFiles: Record<string, Set<string> | undefined>;
  fullOnly: Record<string, Record<string, number>>; // file → { api → count }
  fnsOk: Record<string, Record<string, number>>;
  liteOk: Record<string, Record<string, number>>;
  tzFiles: string[];
};

function detectApis(
  content: string,
  patterns: { re: RegExp; name: string }[],
): Record<string, number> {
  const hits: Record<string, number> = {};
  for (const { re, name } of patterns) {
    const matches = content.match(re);
    if (matches) {
      hits[name] = (hits[name] ?? 0) + matches.length;
    }
  }
  return hits;
}

export function runCheck(dir = ".", showFns = false) {
  const results = scanFiles(dir) as unknown as ApiUsage;
  console.log(`\nFound ${results.total} moment import(s) in ${results.files} file(s):`);
  for (const [file, count] of Object.entries(results.fileCounts)) {
    console.log(`  ${file}: ${count} import(s)`);
  }

  // Analyze API usage
  const hasFullOnly = Object.keys(results.fullOnly).length > 0;

  // Count files that only use fns-compatible APIs
  const fnsOnlyFiles = results.modifiedFiles.filter((f) => {
    const fo = results.fullOnly[f] ?? {};
    const lo = results.liteOk[f] ?? {};
    return Object.keys(fo).length === 0 && Object.keys(lo).length === 0;
  });

  // Count files that only use fns + lite APIs (no full-only)
  const liteOnlyFiles = results.modifiedFiles.filter((f) => {
    const fo = results.fullOnly[f] ?? {};
    return Object.keys(fo).length === 0;
  });

  console.log(`\n=== API Usage Analysis ===`);
  if (hasFullOnly) {
    console.log(`\n⚠  Full-only APIs detected (require 'mmntjs' or 'mmntjs/lite' + plugins):`);
    for (const [file, apis] of Object.entries(results.fullOnly)) {
      for (const [name, count] of Object.entries(apis)) {
        console.log(`  ${file}: ${name} (×${count})`);
      }
    }
  }

  console.log(`\n📊 Recommendation:`);
  if (results.files === 0) {
    console.log(`  No migration needed.`);
    return;
  }
  if (fnsOnlyFiles.length === results.files) {
    console.log(`  ✅ All files can use 'mmntjs/fns' → ~0.5-1.3KB gzip bundled`);
    if (!showFns) {
      console.log(`  💡 Run with --fns to see fns migration details.`);
    }
  } else if (liteOnlyFiles.length === results.files) {
    console.log(`  ✅ All files can use 'mmntjs/lite' → ~14.8KB gzip bundled`);
    console.log(`  💡 Run with --fns to check fns compatibility.`);
  } else {
    const needFull = results.files - liteOnlyFiles.length;
    console.log(
      `  ⚠  ${liteOnlyFiles.length < results.files ? String(needFull) : "0"} file(s) need 'mmntjs' (full) → ~45.1KB gzip bundled`,
    );
    console.log(
      `  💡 ${liteOnlyFiles.length}/${results.files} file(s) can switch to 'mmntjs/lite' → ~14.8KB gzip bundled`,
    );
    if (showFns && fnsOnlyFiles.length > 0) {
      console.log(
        `  💡 ${fnsOnlyFiles.length}/${results.files} file(s) can use 'mmntjs/fns' → ~0.5-1.3KB gzip bundled`,
      );
    }
    if (needFull > 0 && needFull < results.files) {
      console.log(`  ⚠  Mixed entries bundle both 'mmntjs' and 'mmntjs/lite'.`);
      console.log(`  → Defaulting all files to 'mmntjs' (full) to avoid duplicate bundle.`);
      console.log(`  → Use --fns to force 'mmntjs/fns' (may break full-only APIs).`);
    }
  }

  if (results.localeFiles.length > 0) {
    console.log(`\n⚠  ${results.localeFiles.length} file(s) import moment locale:`);
    for (const file of results.localeFiles) {
      console.log(`  ${file}`);
    }
    console.log("  Side-effect locale imports will be transformed to mmntjs/locale-auto/*.\n");
  }

  if (results.tzFiles.length > 0) {
    console.log(`\n⚠  ${results.tzFiles.length} file(s) import moment-timezone:`);
    for (const file of results.tzFiles) {
      console.log(`  ${file}`);
    }
    console.log("  moment-timezone imports will be rewritten to mmntjs + mmntjs-timezone.\n");
  }
  const dynKeys = Object.keys(results.dynamicLocaleFiles);
  if (dynKeys.length > 0) {
    console.log(`\n⚠  ${dynKeys.length} file(s) use moment.locale() with string literals:`);
    for (const file of dynKeys) {
      const dynamicLocales = results.dynamicLocaleFiles[file];
      if (!dynamicLocales) {
        continue;
      }
      console.log(`  ${file}: ${[...dynamicLocales].join(", ")}`);
    }
    console.log("  Will have import + defineLocale injected at file top.\n");
  }
  console.log(`Run \`mmntjs migrate --apply\` to auto-migrate to best target.`);
  console.log(`    → fns-compatible files: 'mmntjs/fns' (~0.5-1.3KB gzip bundled)`);
  console.log(`    → lite-compatible files: 'mmntjs/lite' (~14.8KB gzip bundled)`);
  console.log(`    → full-only files:       'mmntjs' (~45.1KB gzip bundled)`);
  if (results.tzFiles.length > 0) {
    console.log(`    → timezone files:        plus 'mmntjs-timezone' side-effect import`);
  }
  console.log();
  console.log("💡 Recommended next steps:");
  console.log("   git checkout -b migrate-mmntjs");
  console.log("   Run your test suite to verify the current state.");
}

const IMPORT_TARGETS: Record<string, string> = {
  full: "mmntjs",
  lite: "mmntjs/lite",
  fns: "mmntjs/fns",
};

export function runApply(dir = ".", target = "auto", dry = false) {
  const results = scanFiles(dir) as unknown as ApiUsage;
  const hasFullOnly = Object.keys(results.fullOnly).length > 0;
  let modified = 0;
  for (const file of results.modifiedFiles) {
    let pkg: string;
    if (target === "fns") {
      pkg = IMPORT_TARGETS.fns;
    } else if (target === "lite") {
      pkg = IMPORT_TARGETS.lite;
    } else if (target === "full" || hasFullOnly) {
      pkg = IMPORT_TARGETS.full;
    } else {
      const fo = results.fullOnly[file] ?? {};
      pkg = Object.keys(fo).length === 0 ? IMPORT_TARGETS.lite : IMPORT_TARGETS.full;
    }
    const IMPORT_PATTERNS_LITE = [
      { from: /from\s+['"]mmntjs['"]|from\s+['"]moment['"]/g, to: `from '${pkg}'` },
      { from: /require\(['"]mmntjs['"]\)|require\(['"]moment['"]\)/g, to: `require('${pkg}')` },
      { from: /from\s+['"]moment\/locale\//g, to: "from 'mmntjs/locale/" },
      { from: /require\(['"]moment\/locale\//g, to: "require('mmntjs/locale/" },
      { from: /import\s+(\w+)\s+from\s+['"]moment['"]/g, to: `import $1 from '${pkg}'` },
      { from: /import\s+['"]moment-timezone['"]/g, to: "import 'mmntjs-timezone'" },
      { from: /from\s+['"]moment-timezone['"]/g, to: `from '${pkg}'` },
      { from: /require\(['"]moment-timezone['"]\)/g, to: `require('${pkg}')` },
      { from: /import\s+(\w+)\s+from\s+['"]moment-timezone['"]/g, to: `import $1 from '${pkg}'` },
    ];
    let content = fs.readFileSync(file, "utf-8");
    const original = content;
    const isTimezoneFile = results.tzFiles.includes(file);
    // 1. Apply simple path replacements (non-locale imports)
    for (const pattern of IMPORT_PATTERNS_LITE) {
      content = content.replace(pattern.from, pattern.to);
    }
    // 2. Insert timezone side-effect import after the main moment import
    if (isTimezoneFile && !/['"]mmntjs\/timezone['"]/.test(content)) {
      const lines = content.split("\n");
      const isEsm = /^import\s/m.test(content);
      const tzImport = isEsm ? `import 'mmntjs-timezone';` : `require('mmntjs-timezone');`;
      const insertAt = lines.findIndex(
        (l) => /import\s+moment\s+from\s+['"]mmntjs/.test(l) || /const\s+moment\s*=/.test(l),
      );
      if (insertAt >= 0) {
        lines.splice(insertAt + 1, 0, tzImport);
        content = lines.join("\n");
      }
    }
    // 2. Transform locale imports into locale-auto or explicit defineLocale
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
        content = content.replace(/^/, `${preamble}\n`);
      } else {
        content = `${preamble}\n${content}`;
      }
    }
    if (content !== original) {
      const rel = file.replace(dir, "").replace(/^\//, "");
      const newPath = content.match(/from '([^']+)'/)?.[1] ?? "?";
      const fo = results.fullOnly[file] ?? {};
      const apis = Object.keys(fo);
      const apiNote = apis.length > 0 ? ` (full-only: ${apis.join(", ")})` : "";
      console.log(`  ${dry ? "DRY" : "✓"} ${rel}: → ${newPath}${apiNote}`);
      if (!dry) {
        fs.writeFileSync(file, content, "utf-8");
      }
      modified++;
    }
  }
  if (hasFullOnly) {
    console.log(
      `\nℹ  Some files use full-only APIs. All files defaulted to 'mmntjs' to avoid bundling both 'mmntjs' and 'mmntjs/lite'.`,
    );
  }
  if (dry) {
    console.log(`\nWould update ${modified} file(s). Run without --dry to apply.`);
  } else {
    if (results.localeFiles.length > 0 || Object.keys(results.dynamicLocaleFiles).length > 0) {
      console.log(`\n⚠  Locale imports added. Verify that \`moment\` is in scope.`);
    }
    console.log(`\nUpdated ${modified} file(s).`);
  }
}

export function scanFiles(dir: string): ApiUsage {
  const results: ApiUsage = {
    total: 0,
    files: 0,
    fileCounts: {},
    modifiedFiles: [],
    localeFiles: [],
    dynamicLocaleFiles: {},
    fullOnly: {},
    fnsOk: {},
    liteOk: {},
    tzFiles: [],
  };

  walkSourceFiles(dir, (p) => {
    const content = fs.readFileSync(p, "utf-8");
    if (LOCALE_IMPORT_RE.test(content)) {
      results.localeFiles.push(p);
    }
    if (content.includes("moment-timezone")) {
      results.tzFiles.push(p);
    }
    // Detect dynamic locale calls
    const dynamicLocales = new Set<string>();
    let m: RegExpExecArray | null;
    LOCALE_CALL_RE.lastIndex = 0;
    while ((m = LOCALE_CALL_RE.exec(content)) !== null) {
      const name = m[1].toLowerCase();
      if (name !== "en") {
        dynamicLocales.add(name);
      }
    }
    if (dynamicLocales.size > 0) {
      results.dynamicLocaleFiles[p] = dynamicLocales;
    }
    // Detect API usage
    const fo = detectApis(content, FULL_ONLY_RE);
    if (Object.keys(fo).length > 0) {
      results.fullOnly[p] = fo;
    }
    const fn = detectApis(content, FNS_OK_RE);
    if (Object.keys(fn).length > 0) {
      results.fnsOk[p] = fn;
    }
    const lo = detectApis(content, LITE_OK_RE);
    if (Object.keys(lo).length > 0) {
      results.liteOk[p] = lo;
    }
    let count = 0;
    for (const pattern of IMPORT_PATTERNS) {
      const matches = content.match(pattern.from);
      if (matches) {
        count += matches.length;
      }
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
